/* =========================================================
   RESQ-ROUTE
   AUTOMATIC BED ALLOCATION SYSTEM
   =========================================================

   FLOW:

   Family creates emergency
          ↓
   emergencies table
          ↓
   Hospital receives emergency
          ↓
   System finds suitable AVAILABLE bed
          ↓
   Bed becomes RESERVED
          ↓
   Hospital can:
      CONFIRM
      OR
      CHANGE BED
          ↓
   Ambulance arrives
          ↓
   RESERVED → OCCUPIED

   ========================================================= */

(function () {

    "use strict";

    /* =====================================================
       CONFIGURATION
       ===================================================== */

    const CONFIG = {

        confirmationSeconds: 90,

        activeStatuses: [
            "DRIVER_ACCEPTED",
            "EN_ROUTE_TO_PATIENT",
            "ARRIVED_AT_PATIENT",
            "PATIENT_ONBOARD",
            "EN_ROUTE_TO_HOSPITAL",
            "ARRIVED_AT_HOSPITAL"
        ],

        arrivedStatuses: [
            "ARRIVED_AT_HOSPITAL"
        ],

        cancelledStatuses: [
            "CANCELLED",
            "COMPLETED"
        ]

    };


    /* =====================================================
       STATE
       ===================================================== */

    const state = {

        db: null,

        user: null,

        hospitalId: null,

        emergencies: [],

        beds: [],

        timers: new Map(),

        channel: null,

        initialized: false,

        loading: false

    };


    /* =====================================================
       BASIC HELPERS
       ===================================================== */

    function escapeHtml(value) {

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function normalize(value) {

        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_");

    }


    function getPatientName(emergency) {

        return (
            emergency?.patients?.name ||
            emergency?.patient_name ||
            "Emergency Patient"
        );

    }


    function getPriorityRank(priority) {

        const p = normalize(priority);

        if (p === "critical") return 1;

        if (p === "high") return 2;

        if (p === "medium") return 3;

        if (p === "low") return 4;

        return 5;

    }


    function getPriorityClass(priority) {

        const p = normalize(priority);

        if (p === "critical") {
            return "critical";
        }

        if (p === "high") {
            return "high";
        }

        if (p === "medium") {
            return "medium";
        }

        return "low";

    }


    function isActiveEmergency(emergency) {

        const status =
            String(emergency?.status || "")
                .toUpperCase();

        return CONFIG.activeStatuses.includes(status);

    }


    function isArrivedEmergency(emergency) {

        const status =
            String(emergency?.status || "")
                .toUpperCase();

        return CONFIG.arrivedStatuses.includes(status);

    }


    function isCancelledEmergency(emergency) {

        const status =
            String(emergency?.status || "")
                .toUpperCase();

        return CONFIG.cancelledStatuses.includes(status);

    }


    /* =====================================================
       SUPABASE
       ===================================================== */

    function getSupabase() {

        if (
            window.supabaseClient &&
            typeof window.supabaseClient.from === "function"
        ) {

            return window.supabaseClient;

        }

        if (
            window.resqRoute &&
            window.resqRoute.supabase
        ) {

            return window.resqRoute.supabase;

        }

        return null;

    }


    async function getCurrentUser() {

        const db = getSupabase();

        if (!db) {

            throw new Error(
                "Supabase client is unavailable."
            );

        }

        const result =
            await db.auth.getUser();

        if (result.error) {

            throw result.error;

        }

        return result.data?.user || null;

    }


    async function getHospitalId(userId) {

        const result =
            await state.db
                .from("hospital_staff")
                .select("hospital_id")
                .eq("user_id", userId)
                .limit(1)
                .maybeSingle();

        if (result.error) {

            throw result.error;

        }

        return result.data?.hospital_id || null;

    }


    /* =====================================================
       LOAD ACTIVE EMERGENCIES
       ===================================================== */

    async function loadEmergencies() {

        const freshCutoff = new Date(Date.now() - (10 * 60 * 1000)).toISOString();

        const result =
            await state.db
                .from("emergencies")
                .select(`
                    id,
                    patient_id,
                    hospital_id,
                    emergency_type,
                    priority,
                    status,
                    latitude,
                    longitude,
                    condition,
                    created_at,
                    patients (
                        id,
                        name,
                        age,
                        gender
                    )
                `)
                .eq(
                    "hospital_id",
                    state.hospitalId
                )
                .gte(
                    "created_at",
                    freshCutoff
                )
                .not(
                    "ambulance_id",
                    "is",
                    null
                )
                .not(
                    "driver_id",
                    "is",
                    null
                )
                .not(
                    "status",
                    "in",
                    "(COMPLETED,CANCELLED)"
                )
                .order(
                    "created_at",
                    {
                        ascending: true
                    }
                );

        if (result.error) {

            console.error(
                "Emergency loading error:",
                result.error
            );

            throw result.error;

        }

        state.emergencies =
            result.data || [];

        state.emergencies.sort(
            function (a, b) {

                const priorityDifference =
                    getPriorityRank(a.priority) -
                    getPriorityRank(b.priority);

                if (priorityDifference !== 0) {

                    return priorityDifference;

                }

                return (
                    new Date(a.created_at || 0) -
                    new Date(b.created_at || 0)
                );

            }
        );

    }


    /* =====================================================
       LOAD HOSPITAL ROOMS + BEDS
       ===================================================== */

    async function loadBeds() {

        const roomsResult =
            await state.db
                .from("hospital_rooms")
                .select(`
                    id,
                    hospital_id,
                    floor_number,
                    room_number,
                    room_type,
                    status
                `)
                .eq(
                    "hospital_id",
                    state.hospitalId
                );

        if (roomsResult.error) {

            throw roomsResult.error;

        }


        const rooms =
            roomsResult.data || [];


        const bedsResult =
            await state.db
                .from("hospital_resource_slots")
                .select(`
                    id,
                    hospital_id,
                    room_id,
                    resource_type,
                    slot_code,
                    status,
                    patient_id,
                    emergency_id,
                    notes
                `)
                .eq(
                    "hospital_id",
                    state.hospitalId
                )
                .eq(
                    "resource_type",
                    "Bed"
                );


        if (bedsResult.error) {

            throw bedsResult.error;

        }


        const beds =
            bedsResult.data || [];


        state.beds =
            beds.map(
                function (bed) {

                    const room =
                        rooms.find(
                            function (item) {

                                return String(item.id) ===
                                    String(bed.room_id);

                            }
                        );


                    return {

                        ...bed,

                        floor_number:
                            room?.floor_number ?? "-",

                        room_number:
                            room?.room_number ?? "-",

                        room_type:
                            room?.room_type || "Other"

                    };

                }
            );

    }


    /* =====================================================
       BED STATUS
       ===================================================== */

    function normalizeBedStatus(status) {

        const value =
            normalize(status);

        if (value === "available") {

            return "available";

        }

        if (value === "reserved") {

            return "reserved";

        }

        if (
            value === "occupied" ||
            value === "booked" ||
            value === "used" ||
            value === "in_use" ||
            value === "assigned"
        ) {

            return "occupied";

        }

        if (
            value === "maintenance" ||
            value === "repair" ||
            value === "out_of_service" ||
            value === "unavailable"
        ) {

            return "maintenance";

        }

        return value || "available";

    }


    /* =====================================================
       ROOM MATCHING
       ===================================================== */

    function requiredRoomTypes(emergency) {

        const priority =
            normalize(emergency?.priority);

        const emergencyType =
            normalize(
                emergency?.emergency_type
            );

        const condition =
            normalize(
                emergency?.condition
            );


        const explicitRoom =
            normalize(
                emergency?.required_room_type
            );


        const careLevel =
            normalize(
                emergency?.care_level
            );


        if (explicitRoom) {

            return [
                explicitRoom
            ];

        }


        /*
         * CONDITION-BASED ALLOCATION
         *
         * These conditions indicate that the patient
         * may need immediate critical/emergency care.
         *
         * ICU is preferred first, followed by emergency
         * and critical-designated rooms.
         */

        if (
            condition === "critical" ||
            condition === "unconscious" ||
            condition === "breathing" ||
            condition === "bleeding"
        ) {

            return [
                "icu",
                "emergency",
                "critical"
            ];

        }


        if (careLevel === "icu") {

            return [
                "icu",
                "emergency",
                "critical"
            ];

        }


        if (
            emergencyType.includes("cardiac") ||
            emergencyType.includes("heart") ||
            emergencyType.includes("stroke") ||
            emergencyType.includes("respiratory") ||
            emergencyType.includes("critical")
        ) {

            return [
                "icu",
                "emergency",
                "critical"
            ];

        }


        if (priority === "critical") {

            return [
                "icu",
                "emergency",
                "critical"
            ];

        }


        /*
         * A conscious patient without a critical
         * condition can use emergency/general care.
         */

        if (
            condition === "conscious"
        ) {

            if (priority === "high") {

                return [
                    "emergency",
                    "general",
                    "ward",
                    "icu"
                ];

            }

            return [
                "general",
                "ward",
                "emergency",
                "other"
            ];

        }


        if (priority === "high") {

            return [
                "emergency",
                "icu",
                "general"
            ];

        }


        if (priority === "medium") {

            return [
                "emergency",
                "general",
                "ward"
            ];

        }


        return [
            "general",
            "ward",
            "emergency",
            "other"
        ];

    }


    function isSuitableBed(
        bed,
        emergency
    ) {

        if (
            normalizeBedStatus(
                bed.status
            ) !== "available"
        ) {

            return false;

        }


        const roomType =
            normalize(
                bed.room_type
            );


        const allowedTypes =
            requiredRoomTypes(
                emergency
            );


        if (
            allowedTypes.includes(roomType)
        ) {

            return true;

        }


        /*
         * General naming compatibility.
         */

        if (
            roomType.includes("icu") &&
            allowedTypes.includes("icu")
        ) {

            return true;

        }


        if (
            roomType.includes("emergency") &&
            allowedTypes.includes("emergency")
        ) {

            return true;

        }


        if (
            roomType.includes("general") &&
            (
                allowedTypes.includes("general") ||
                allowedTypes.includes("ward")
            )
        ) {

            return true;

        }


        if (
            roomType.includes("ward") &&
            allowedTypes.includes("ward")
        ) {

            return true;

        }


        return false;

    }


    /* =====================================================
       BED SCORING
       ===================================================== */

    function scoreBed(
        bed,
        emergency
    ) {

        let score = 0;


        const roomType =
            normalize(
                bed.room_type
            );


        const allowed =
            requiredRoomTypes(
                emergency
            );


        const roomIndex =
            allowed.indexOf(
                roomType
            );


        if (roomIndex >= 0) {

            score +=
                100 -
                roomIndex * 20;

        }


        /*
         * CONDITION-BASED SCORING
         *
         * The room matching above determines which room types
         * are acceptable. This scoring gives the most appropriate
         * available room an additional preference.
         */

        const condition =
            normalize(emergency?.condition);

        if (
            (
                condition === "critical" ||
                condition === "unconscious" ||
                condition === "breathing" ||
                condition === "bleeding"
            ) &&
            roomType.includes("icu")
        ) {

            score += 80;

        }

        if (
            (
                condition === "critical" ||
                condition === "unconscious" ||
                condition === "breathing" ||
                condition === "bleeding"
            ) &&
            roomType.includes("emergency")
        ) {

            score += 45;

        }

        if (
            condition === "conscious" &&
            (
                roomType.includes("general") ||
                roomType.includes("ward")
            )
        ) {

            score += 25;

        }

        /*
         * Critical priority remains an additional signal.
         */

        if (
            normalize(emergency.priority) ===
            "critical" &&
            roomType.includes("icu")
        ) {

            score += 50;

        }


        /*
         * Prefer lower floor/room as a
         * simple deterministic tie breaker.
         */

        const floor =
            Number(
                bed.floor_number
            ) || 0;


        const room =
            Number(
                bed.room_number
            ) || 0;


        score -= floor * 0.1;

        score -= room * 0.01;


        return score;

    }


    function findBestBed(emergency) {

        const suitable =
            state.beds.filter(
                function (bed) {

                    return isSuitableBed(
                        bed,
                        emergency
                    );

                }
            );


        if (!suitable.length) {

            return null;

        }


        suitable.sort(
            function (a, b) {

                return (
                    scoreBed(b, emergency) -
                    scoreBed(a, emergency)
                );

            }
        );


        return suitable[0];

    }


    /* =====================================================
       FIND EXISTING BED FOR EMERGENCY
       ===================================================== */

    function findBedForEmergency(
        emergencyId
    ) {

        return state.beds.find(
            function (bed) {

                return (
                    String(bed.emergency_id) ===
                    String(emergencyId)
                );

            }
        ) || null;

    }


    /* =====================================================
       RESERVATION TIME
       ===================================================== */

    function getReservationTime(
        bed
    ) {

        /*
         * The reservation time is stored inside
         * notes so the system can recover after
         * page refresh.
         */

        if (!bed?.notes) {

            return null;

        }


        const match =
            String(bed.notes).match(
                /reserved_at=([^|]+)/i
            );


        if (!match) {

            return null;

        }


        const timestamp =
            new Date(
                match[1]
            ).getTime();


        if (
            Number.isNaN(timestamp)
        ) {

            return null;

        }


        return timestamp;

    }


    function getReservationExpiry(
        bed
    ) {

        const reservedAt =
            getReservationTime(
                bed
            );


        if (!reservedAt) {

            return (
                Date.now() +
                CONFIG.confirmationSeconds *
                1000
            );

        }


        return (
            reservedAt +
            CONFIG.confirmationSeconds *
            1000
        );

    }


    function isPendingReservation(
        bed
    ) {

        if (
            !bed ||
            normalizeBedStatus(
                bed.status
            ) !== "reserved"
        ) {

            return false;

        }


        const expiry =
            getReservationExpiry(
                bed
            );


        return (
            Date.now() <
            expiry
        );

    }


    /* =====================================================
       CREATE ALLOCATION HISTORY
       ===================================================== */

    async function createAllocationHistory(
        emergency,
        bed,
        notes
    ) {

        const result =
            await state.db
                .from("resource_allocations")
                .insert({

                    hospital_id:
                        state.hospitalId,

                    resource_slot_id:
                        bed.id,

                    resource_type:
                        "Bed",

                    patient_id:
                        emergency.patient_id,

                    emergency_id:
                        emergency.id,

                    allocated_by:
                        state.user?.id || null,

                    status:
                        "active",

                    notes:
                        notes

                });


        if (result.error) {

            console.warn(
                "Allocation history insert failed:",
                result.error
            );

        }

    }


    /* =====================================================
       CREATE EMERGENCY EVENT
       ===================================================== */

    async function createEmergencyEvent(
        emergencyId,
        eventType,
        description
    ) {

        const result =
            await state.db
                .from("emergency_events")
                .insert({

                    emergency_id:
                        emergencyId,

                    event_type:
                        eventType,

                    description:
                        description

                });


        if (result.error) {

            console.warn(
                "Emergency event insert failed:",
                result.error
            );

        }

    }


    /* =====================================================
       RESERVE BED
       ===================================================== */

    async function reserveBed(
        emergency,
        bed
    ) {

        const now =
            new Date().toISOString();


        const notes =
            [
                "RESQ_AUTO_RESERVED",
                "emergency=" +
                    emergency.id,
                "patient=" +
                    emergency.patient_id,
                "reserved_at=" +
                    now,
                "priority=" +
                    (
                        emergency.priority ||
                        "HIGH"
                    ),
                "condition=" +
                    (
                        emergency.condition ||
                        "UNKNOWN"
                    ),
                "allocation_rule=CONDITION_PRIORITY_TYPE",
                "room_type=" +
                    (
                        bed.room_type ||
                        "Other"
                    )
            ].join("|");


        /*
         * IMPORTANT:
         *
         * We only update the bed if it is
         * STILL AVAILABLE.
         *
         * This protects against two browser
         * tabs taking the same bed.
         */

        const updateResult =
            await state.db
                .from(
                    "hospital_resource_slots"
                )
                .update({

                    status:
                        "reserved",

                    patient_id:
                        emergency.patient_id,

                    emergency_id:
                        emergency.id,

                    notes:
                        notes

                })
                .eq(
                    "id",
                    bed.id
                )
                .eq(
                    "hospital_id",
                    state.hospitalId
                )
                .eq(
                    "status",
                    "available"
                )
                .select(
                    `
                    id,
                    status,
                    patient_id,
                    emergency_id,
                    notes
                    `
                )
                .maybeSingle();


        if (updateResult.error) {

            throw updateResult.error;

        }


        /*
         * No returned row means another
         * request took the bed first.
         */

        if (!updateResult.data) {

            return null;

        }


        const reservedBed =
            {
                ...bed,

                ...updateResult.data,

                status:
                    "reserved"

            };


        await createAllocationHistory(
            emergency,
            reservedBed,
            "Automatically allocated by ResQ-Route."
        );


        await createEmergencyEvent(
            emergency.id,
            "BED_AUTO_RESERVED",
            "Bed " +
                (
                    bed.slot_code ||
                    bed.id
                ) +
                " automatically reserved."
        );


        return reservedBed;

    }


    /* =====================================================
       PROCESS ONE EMERGENCY
       ===================================================== */

    async function processEmergency(
        emergency
    ) {

        if (
            !isActiveEmergency(
                emergency
            )
        ) {

            return;

        }


        /*
         * Check whether a bed is already
         * allocated.
         */

        const existingBed =
            findBedForEmergency(
                emergency.id
            );


        if (existingBed) {

            return;

        }


        /*
         * Find best suitable bed.
         */

        const bestBed =
            findBestBed(
                emergency
            );


        if (!bestBed) {

            return;

        }


        /*
         * Reserve it.
         */

        await reserveBed(
            emergency,
            bestBed
        );

    }


    /* =====================================================
       PROCESS ALL EMERGENCIES
       ===================================================== */

    async function processAutomaticAllocations() {

        if (
            state.loading ||
            !state.db ||
            !state.hospitalId
        ) {

            return;

        }


        state.loading = true;


        try {

            await loadEmergencies();

            await loadBeds();


            /*
             * Highest priority patients
             * are processed first.
             */

            for (
                const emergency
                of state.emergencies
            ) {

                await processEmergency(
                    emergency
                );

            }


            await loadBeds();

            renderAllocationList();

            restartAllTimers();


        } catch (error) {

            console.error(
                "Automatic allocation error:",
                error
            );


            showAllocationError(
                error
            );

        } finally {

            state.loading = false;

        }

    }


    /* =====================================================
       TIMER
       ===================================================== */

    function stopTimer(
        bedId
    ) {

        const timer =
            state.timers.get(
                String(bedId)
            );


        if (timer) {

            clearInterval(
                timer
            );

            state.timers.delete(
                String(bedId)
            );

        }

    }


    function startTimer(
        bed
    ) {

        if (
            !bed ||
            !isPendingReservation(
                bed
            )
        ) {

            return;

        }


        stopTimer(
            bed.id
        );


        const timer =
            setInterval(
                async function () {

                    const currentBed =
                        state.beds.find(
                            function (item) {

                                return String(item.id) ===
                                    String(bed.id);

                            }
                        );


                    if (
                        !currentBed ||
                        normalizeBedStatus(
                            currentBed.status
                        ) !== "reserved"
                    ) {

                        stopTimer(
                            bed.id
                        );

                        return;

                    }


                    const expiry =
                        getReservationExpiry(
                            currentBed
                        );


                    const remaining =
                        Math.max(
                            0,
                            Math.ceil(
                                (
                                    expiry -
                                    Date.now()
                                ) / 1000
                            )
                        );


                    updateTimerDisplay(
                        currentBed.id,
                        remaining
                    );


                    if (
                        remaining <= 0
                    ) {

                        stopTimer(
                            currentBed.id
                        );


                        await confirmAutomaticAllocation(
                            currentBed.emergency_id,
                            true
                        );

                    }

                },
                1000
            );


        state.timers.set(
            String(bed.id),
            timer
        );

    }


    function restartAllTimers() {

        state.timers.forEach(
            function (_, key) {

                stopTimer(key);

            }
        );


        state.beds.forEach(
            function (bed) {

                if (
                    isPendingReservation(
                        bed
                    )
                ) {

                    startTimer(
                        bed
                    );

                }

            }
        );

    }


    function updateTimerDisplay(
        bedId,
        seconds
    ) {

        const elements =
            document.querySelectorAll(
                `[data-auto-timer="${bedId}"]`
            );


        elements.forEach(
            function (element) {

                const minutes =
                    Math.floor(
                        seconds / 60
                    );


                const remainingSeconds =
                    seconds % 60;


                element.textContent =
                    String(minutes)
                        .padStart(2, "0") +
                    ":" +
                    String(
                        remainingSeconds
                    ).padStart(2, "0");


                if (
                    seconds <= 20
                ) {

                    element.classList.add(
                        "timer-danger"
                    );

                } else {

                    element.classList.remove(
                        "timer-danger"
                    );

                }

            }
        );

    }


    /* =====================================================
       CONFIRM AUTOMATIC ALLOCATION
       ===================================================== */

    async function confirmAutomaticAllocation(
        emergencyId,
        automatic
    ) {

        const bed =
            findBedForEmergency(
                emergencyId
            );


        if (!bed) {

            return;

        }


        if (
            normalizeBedStatus(
                bed.status
            ) !== "reserved"
        ) {

            return;

        }


        stopTimer(
            bed.id
        );


        const confirmationNote =
            [
                "RESQ_AUTO_CONFIRMED",
                "emergency=" +
                    emergencyId,
                "confirmed_at=" +
                    new Date().toISOString()
            ].join("|");


        const result =
            await state.db
                .from(
                    "hospital_resource_slots"
                )
                .update({

                    notes:
                        confirmationNote

                })
                .eq(
                    "id",
                    bed.id
                )
                .eq(
                    "hospital_id",
                    state.hospitalId
                )
                .eq(
                    "status",
                    "reserved"
                )
                .eq(
                    "emergency_id",
                    emergencyId
                )
                .select(
                    "id,status,notes"
                )
                .maybeSingle();


        if (result.error) {

            console.error(
                "Confirmation error:",
                result.error
            );

            return;

        }


        if (!result.data) {

            return;

        }


        await createEmergencyEvent(
            emergencyId,
            automatic
                ? "BED_AUTO_CONFIRMED"
                : "BED_CONFIRMED",
            automatic
                ? "Automatic bed allocation confirmed after timeout."
                : "Hospital staff confirmed the automatic bed allocation."
        );


        await loadBeds();

        renderAllocationList();

    }


    /* =====================================================
       REALLOCATION
       ===================================================== */

    let reallocationEmergencyId =
        null;

    let reallocationSelectedBedId =
        null;


    function ensureReallocationModal() {

        if (
            document.getElementById(
                "resqReallocationModal"
            )
        ) {

            return;

        }


        const modal =
            document.createElement(
                "div"
            );


        modal.id =
            "resqReallocationModal";


        modal.innerHTML = `

            <div class="resq-modal-overlay">

                <div class="resq-modal">

                    <h2>
                        Change Bed Allocation
                    </h2>

                    <p
                        id="resqReallocationPatient"
                        class="resq-modal-subtitle"
                    >
                        Select another suitable bed.
                    </p>

                    <div
                        id="resqCurrentBed"
                        class="resq-current-bed"
                    >
                    </div>

                    <div
                        id="resqAvailableBeds"
                        class="resq-available-beds"
                    >
                        Loading...
                    </div>

                    <div class="resq-modal-actions">

                        <button
                            type="button"
                            id="resqCancelReallocation"
                            class="resq-btn secondary"
                        >
                            CANCEL
                        </button>

                        <button
                            type="button"
                            id="resqConfirmReallocation"
                            class="resq-btn primary"
                            disabled
                        >
                            CONFIRM NEW BED
                        </button>

                    </div>

                </div>

            </div>

        `;


        document.body.appendChild(
            modal
        );


        document
            .getElementById(
                "resqCancelReallocation"
            )
            .addEventListener(
                "click",
                closeReallocationModal
            );


        document
            .getElementById(
                "resqConfirmReallocation"
            )
            .addEventListener(
                "click",
                confirmReallocation
            );

    }


    function openReallocationModal(
        emergencyId
    ) {

        ensureReallocationModal();


        const emergency =
            state.emergencies.find(
                function (item) {

                    return String(item.id) ===
                        String(emergencyId);

                }
            );


        const oldBed =
            findBedForEmergency(
                emergencyId
            );


        if (
            !emergency ||
            !oldBed
        ) {

            alert(
                "Current bed allocation could not be found."
            );

            return;

        }


        reallocationEmergencyId =
            emergencyId;


        reallocationSelectedBedId =
            null;


        const modal =
            document.getElementById(
                "resqReallocationModal"
            );


        modal.classList.add(
            "show"
        );


        const patientElement =
            document.getElementById(
                "resqReallocationPatient"
            );


        if (patientElement) {

            patientElement.textContent =
                "Patient: " +
                getPatientName(
                    emergency
                );

        }


        const currentElement =
            document.getElementById(
                "resqCurrentBed"
            );


        if (currentElement) {

            currentElement.innerHTML =
                `
                    <strong>
                        Current Bed
                    </strong>
                    <br>
                    ${escapeHtml(
                        getBedLabel(
                            oldBed
                        )
                    )}
                `;

        }


        const availableBeds =
            state.beds.filter(
                function (bed) {

                    return (
                        String(bed.id) !==
                        String(oldBed.id)
                    ) &&
                    isSuitableBed(
                        bed,
                        emergency
                    );

                }
            );


        renderReallocationBeds(
            availableBeds
        );

    }


    function renderReallocationBeds(
        beds
    ) {

        const container =
            document.getElementById(
                "resqAvailableBeds"
            );


        if (!container) {

            return;

        }


        if (!beds.length) {

            container.innerHTML = `

                <div class="resq-no-beds">

                    No other suitable available beds
                    are currently available.

                </div>

            `;

            return;

        }


        container.innerHTML =
            beds.map(
                function (bed) {

                    return `

                        <button
                            type="button"
                            class="resq-bed-option"
                            data-bed-id="${escapeHtml(
                                bed.id
                            )}"
                        >

                            <strong>
                                ${escapeHtml(
                                    bed.slot_code ||
                                    "Bed"
                                )}
                            </strong>

                            <span>
                                Floor
                                ${escapeHtml(
                                    bed.floor_number
                                )}
                                •
                                Room
                                ${escapeHtml(
                                    bed.room_number
                                )}
                            </span>

                            <small>
                                ${escapeHtml(
                                    formatRoomType(
                                        bed.room_type
                                    )
                                )}
                            </small>

                        </button>

                    `;

                }
            )
            .join("");


        container
            .querySelectorAll(
                ".resq-bed-option"
            )
            .forEach(
                function (button) {

                    button.addEventListener(
                        "click",
                        function () {

                            container
                                .querySelectorAll(
                                    ".resq-bed-option"
                                )
                                .forEach(
                                    function (item) {

                                        item.classList.remove(
                                            "selected"
                                        );

                                    }
                                );


                            button.classList.add(
                                "selected"
                            );


                            reallocationSelectedBedId =
                                button.dataset.bedId;


                            const confirmButton =
                                document.getElementById(
                                    "resqConfirmReallocation"
                                );


                            if (confirmButton) {

                                confirmButton.disabled =
                                    false;

                            }

                        }
                    );

                }
            );

    }


    async function confirmReallocation() {

        const emergency =
            state.emergencies.find(
                function (item) {

                    return String(item.id) ===
                        String(
                            reallocationEmergencyId
                        );

                }
            );


        const oldBed =
            findBedForEmergency(
                reallocationEmergencyId
            );


        const newBed =
            state.beds.find(
                function (bed) {

                    return String(bed.id) ===
                        String(
                            reallocationSelectedBedId
                        );

                }
            );


        if (
            !emergency ||
            !oldBed ||
            !newBed
        ) {

            alert(
                "The selected allocation is no longer available."
            );

            closeReallocationModal();

            await processAutomaticAllocations();

            return;

        }


        const button =
            document.getElementById(
                "resqConfirmReallocation"
            );


        if (button) {

            button.disabled = true;

            button.textContent =
                "CHANGING...";

        }


        try {

            /*
             * STEP 1
             *
             * Reserve NEW bed first.
             */

            const newReservation =
                await reserveBed(
                    emergency,
                    newBed
                );


            if (!newReservation) {

                throw new Error(
                    "That bed was just taken. Please select another bed."
                );

            }


            /*
             * STEP 2
             *
             * Release OLD bed.
             */

            const releaseResult =
                await state.db
                    .from(
                        "hospital_resource_slots"
                    )
                    .update({

                        status:
                            "available",

                        patient_id:
                            null,

                        emergency_id:
                            null,

                        notes:
                            "RESQ_REALLOCATED|" +
                            "emergency=" +
                            emergency.id

                    })
                    .eq(
                        "id",
                        oldBed.id
                    )
                    .eq(
                        "hospital_id",
                        state.hospitalId
                    )
                    .eq(
                        "status",
                        "reserved"
                    )
                    .eq(
                        "emergency_id",
                        emergency.id
                    );


            if (
                releaseResult.error
            ) {

                throw releaseResult.error;

            }


            stopTimer(
                oldBed.id
            );


            await createEmergencyEvent(
                emergency.id,
                "BED_REALLOCATED",
                "Bed changed from " +
                    (
                        oldBed.slot_code ||
                        oldBed.id
                    ) +
                    " to " +
                    (
                        newBed.slot_code ||
                        newBed.id
                    ) +
                    "."
            );


            closeReallocationModal();


            await loadBeds();

            renderAllocationList();

            restartAllTimers();


        } catch (error) {

            console.error(
                "Reallocation error:",
                error
            );


            alert(
                error.message ||
                "Unable to change the bed allocation."
            );


            await loadBeds();

            renderAllocationList();

            restartAllTimers();

        } finally {

            if (button) {

                button.disabled =
                    !reallocationSelectedBedId;

                button.textContent =
                    "CONFIRM NEW BED";

            }

        }

    }


    function closeReallocationModal() {

        const modal =
            document.getElementById(
                "resqReallocationModal"
            );


        if (modal) {

            modal.classList.remove(
                "show"
            );

        }


        reallocationEmergencyId =
            null;


        reallocationSelectedBedId =
            null;

    }


    /* =====================================================
       AMBULANCE ARRIVAL
       ===================================================== */

    async function handleEmergencyStatusChange(
        emergency
    ) {

        if (!emergency) {

            return;

        }


        const emergencyId =
            emergency.id;


        const bed =
            findBedForEmergency(
                emergencyId
            );


        if (
            bed &&
            normalizeBedStatus(
                bed.status
            ) === "reserved" &&
            isArrivedEmergency(
                emergency
            )
        ) {

            const result =
                await state.db
                    .from(
                        "hospital_resource_slots"
                    )
                    .update({

                        status:
                            "occupied",

                        notes:
                            "RESQ_AUTO_OCCUPIED|" +
                            "emergency=" +
                            emergencyId

                    })
                    .eq(
                        "id",
                        bed.id
                    )
                    .eq(
                        "hospital_id",
                        state.hospitalId
                    )
                    .eq(
                        "status",
                        "reserved"
                    )
                    .eq(
                        "emergency_id",
                        emergencyId
                    );


            if (
                result.error
            ) {

                console.error(
                    "Arrival bed update error:",
                    result.error
                );

                return;

            }


            stopTimer(
                bed.id
            );


            await createEmergencyEvent(
                emergencyId,
                "BED_OCCUPIED",
                "Automatically allocated bed marked occupied when ambulance arrived."
            );


            await loadBeds();

            renderAllocationList();

            return;

        }


        /*
         * If emergency was cancelled
         * before arrival, release reservation.
         */

        if (
            bed &&
            normalizeBedStatus(
                bed.status
            ) === "reserved" &&
            isCancelledEmergency(
                emergency
            )
        ) {

            const result =
                await state.db
                    .from(
                        "hospital_resource_slots"
                    )
                    .update({

                        status:
                            "available",

                        patient_id:
                            null,

                        emergency_id:
                            null,

                        notes:
                            "RESQ_AUTO_RELEASED|" +
                            "emergency=" +
                            emergencyId

                    })
                    .eq(
                        "id",
                        bed.id
                    )
                    .eq(
                        "hospital_id",
                        state.hospitalId
                    )
                    .eq(
                        "status",
                        "reserved"
                    )
                    .eq(
                        "emergency_id",
                        emergencyId
                    );


            if (
                result.error
            ) {

                console.error(
                    "Bed release error:",
                    result.error
                );

                return;

            }


            stopTimer(
                bed.id
            );


            await loadBeds();

            renderAllocationList();

        }

    }


    /* =====================================================
       BED LABEL
       ===================================================== */

    function getBedLabel(
        bed
    ) {

        if (!bed) {

            return "No bed";

        }


        return (
            "Floor " +
            (
                bed.floor_number ??
                "-"
            ) +
            " • Room " +
            (
                bed.room_number ??
                "-"
            ) +
            " • " +
            (
                bed.slot_code ||
                "Bed"
            )
        );

    }


    function formatRoomType(
        value
    ) {

        return String(
            value ||
            "Other"
        )
            .replace(
                /_/g,
                " "
            )
            .replace(
                /\b\w/g,
                function (char) {

                    return char.toUpperCase();

                }
            );

    }


    /* =====================================================
       ALLOCATION UI
       ===================================================== */

    function renderAllocationList() {

        const list =
            document.getElementById(
                "autoAllocationList"
            );


        if (!list) {

            return;

        }


        const active =
            state.emergencies
                .filter(
                    isActiveEmergency
                );


        if (!active.length) {

            list.innerHTML = `

                <div class="auto-empty">

                    No active emergency requests.

                </div>

            `;


            updateAllocationCount();

            return;

        }


        list.innerHTML =
            active.map(
                function (emergency) {

                    const bed =
                        findBedForEmergency(
                            emergency.id
                        );


                    const priority =
                        String(
                            emergency.priority ||
                            "HIGH"
                        ).toUpperCase();


                    const priorityClass =
                        getPriorityClass(
                            emergency.priority
                        );


                    /*
                     * Patient has no bed yet.
                     */

                    if (!bed) {

                        return `

                            <div
                                class="auto-case waiting-case"
                            >

                                <div class="auto-case-patient">

                                    <strong>
                                        ${escapeHtml(
                                            getPatientName(
                                                emergency
                                            )
                                        )}
                                    </strong>

                                    <small>
                                        Emergency:
                                        ${escapeHtml(
                                            emergency.id
                                        )}
                                    </small>

                                </div>


                                <div class="auto-case-info">

                                    <span
                                        class="priority-badge ${priorityClass}"
                                    >
                                        ${escapeHtml(
                                            priority
                                        )}
                                    </span>

                                    <span>
                                        ${escapeHtml(
                                            emergency.emergency_type ||
                                            "Emergency"
                                        )}
                                    </span>

                                    <span>
                                        Condition:
                                        ${escapeHtml(
                                            emergency.condition ||
                                            "Unknown"
                                        )}
                                    </span>

                                </div>


                                <div class="auto-case-bed">

                                    <strong>
                                        Waiting for bed
                                    </strong>

                                    <small>
                                        No suitable available
                                        bed currently found.
                                    </small>

                                </div>


                            </div>

                        `;

                    }


                    const pending =
                        isPendingReservation(
                            bed
                        );


                    const status =
                        normalizeBedStatus(
                            bed.status
                        );


                    let timerHtml =
                        "";


                    if (pending) {

                        const expiry =
                            getReservationExpiry(
                                bed
                            );


                        const seconds =
                            Math.max(
                                0,
                                Math.ceil(
                                    (
                                        expiry -
                                        Date.now()
                                    ) / 1000
                                )
                            );


                        const minutes =
                            Math.floor(
                                seconds / 60
                            );


                        const remaining =
                            seconds % 60;


                        timerHtml = `

                            <div
                                class="auto-timer"
                                data-auto-timer="${escapeHtml(
                                    bed.id
                                )}"
                            >
                                ${String(
                                    minutes
                                ).padStart(2, "0")}:${String(
                                    remaining
                                ).padStart(2, "0")}
                            </div>

                        `;

                    }


                    let statusText =
                        "RESERVED";


                    if (
                        status ===
                        "occupied"
                    ) {

                        statusText =
                            "OCCUPIED";

                    }


                    return `

                        <div
                            class="auto-case ${
                                priorityClass ===
                                "critical"
                                    ? "critical-case"
                                    : ""
                            }"
                        >

                            <div class="auto-case-patient">

                                <strong>
                                    ${escapeHtml(
                                        getPatientName(
                                            emergency
                                        )
                                    )}
                                </strong>

                                <small>
                                    Emergency:
                                    ${escapeHtml(
                                        emergency.id
                                    )}
                                </small>

                                <small>
                                    ${escapeHtml(
                                        emergency.emergency_type ||
                                        "Emergency"
                                    )}
                                </small>

                                <small>
                                    Condition:
                                    ${escapeHtml(
                                        emergency.condition ||
                                        "Unknown"
                                    )}
                                </small>

                            </div>


                            <div class="auto-case-info">

                                <span
                                    class="priority-badge ${priorityClass}"
                                >
                                    ${escapeHtml(
                                        priority
                                    )}
                                </span>

                                <span>
                                    ${escapeHtml(
                                        emergency.status
                                    )}
                                </span>

                            </div>


                            <div class="auto-case-bed">

                                <strong>
                                    ${escapeHtml(
                                        getBedLabel(
                                            bed
                                        )
                                    )}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                        formatRoomType(
                                            bed.room_type
                                        )
                                    )}
                                </small>

                                <small>
                                    ${statusText}
                                </small>

                            </div>


                            <div class="auto-case-actions">

                                ${
                                    pending
                                        ? `
                                            ${timerHtml}

                                            <button
                                                type="button"
                                                class="auto-btn confirm"
                                                data-confirm-emergency="${escapeHtml(
                                                    emergency.id
                                                )}"
                                            >
                                                CONFIRM
                                            </button>
                                        `
                                        : ""
                                }


                                ${
                                    status ===
                                    "reserved"
                                        ? `
                                            <button
                                                type="button"
                                                class="auto-btn change"
                                                data-change-emergency="${escapeHtml(
                                                    emergency.id
                                                )}"
                                            >
                                                CHANGE BED
                                            </button>
                                        `
                                        : ""
                                }


                                ${
                                    status ===
                                    "occupied"
                                        ? `
                                            <span
                                                class="occupied-label"
                                            >
                                                PATIENT IN BED
                                            </span>
                                        `
                                        : ""
                                }

                            </div>

                        </div>

                    `;

                }
            )
            .join("");


        attachAllocationButtons();

        updateAllocationCount();

    }


    function attachAllocationButtons() {

        document
            .querySelectorAll(
                "[data-confirm-emergency]"
            )
            .forEach(
                function (button) {

                    button.addEventListener(
                        "click",
                        async function () {

                            button.disabled =
                                true;


                            await confirmAutomaticAllocation(
                                button.dataset
                                    .confirmEmergency,
                                false
                            );

                        }
                    );

                }
            );


        document
            .querySelectorAll(
                "[data-change-emergency]"
            )
            .forEach(
                function (button) {

                    button.addEventListener(
                        "click",
                        function () {

                            openReallocationModal(
                                button.dataset
                                    .changeEmergency
                            );

                        }
                    );

                }
            );

    }


    function updateAllocationCount() {

        const counter =
            document.getElementById(
                "autoAllocationCount"
            );


        if (!counter) {

            return;

        }


        const count =
            state.beds.filter(
                function (bed) {

                    return (
                        normalizeBedStatus(
                            bed.status
                        ) ===
                        "reserved"
                    );

                }
            ).length;


        counter.textContent =
            String(count);

    }


    function showAllocationError(
        error
    ) {

        const list =
            document.getElementById(
                "autoAllocationList"
            );


        if (!list) {

            return;

        }


        list.innerHTML = `

            <div class="auto-empty">

                Automatic allocation could not
                connect to the hospital data.

                <br>

                <small>
                    ${escapeHtml(
                        error?.message ||
                        "Unknown error"
                    )}
                </small>

            </div>

        `;

    }


    /* =====================================================
       CSS
       ===================================================== */

    function injectStyles() {

        if (
            document.getElementById(
                "resqAutoBedStyles"
            )
        ) {

            return;

        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "resqAutoBedStyles";


        style.textContent = `

            .auto-case {

                display: grid;

                grid-template-columns:
                    1.2fr
                    .8fr
                    1.4fr
                    auto;

                gap: 16px;

                align-items: center;

                background: #ffffff;

                border: 1px solid #e4e8ee;

                border-radius: 14px;

                padding: 16px;

                margin-bottom: 12px;

            }


            .auto-case.critical-case {

                border-left:
                    5px solid #e63946;

            }


            .auto-case-patient {

                display: flex;

                flex-direction: column;

                gap: 4px;

            }


            .auto-case-patient strong {

                font-size: 15px;

                color: #172033;

            }


            .auto-case-patient small {

                color: #687386;

                font-size: 11px;

            }


            .auto-case-info {

                display: flex;

                flex-direction: column;

                gap: 7px;

                font-size: 11px;

                color: #687386;

            }


            .priority-badge {

                width: fit-content;

                padding: 5px 9px;

                border-radius: 20px;

                font-weight: 800;

                font-size: 10px;

            }


            .priority-badge.critical {

                background: #fff0f1;

                color: #c72535;

            }


            .priority-badge.high {

                background: #fff5e8;

                color: #9b6813;

            }


            .priority-badge.medium {

                background: #eef5ff;

                color: #2463a5;

            }


            .priority-badge.low {

                background: #eef8f1;

                color: #237444;

            }


            .auto-case-bed {

                display: flex;

                flex-direction: column;

                gap: 5px;

            }


            .auto-case-bed strong {

                font-size: 13px;

                color: #172033;

            }


            .auto-case-bed small {

                color: #687386;

                font-size: 11px;

            }


            .auto-case-actions {

                display: flex;

                align-items: center;

                justify-content: flex-end;

                gap: 7px;

                flex-wrap: wrap;

            }


            .auto-timer {

                font-size: 17px;

                font-weight: 900;

                color: #e63946;

                min-width: 52px;

                text-align: center;

            }


            .auto-timer.timer-danger {

                animation: resqPulse .8s infinite;

            }


            @keyframes resqPulse {

                50% {

                    opacity: .35;

                }

            }


            .auto-btn {

                border: 0;

                border-radius: 8px;

                padding: 9px 12px;

                cursor: pointer;

                font-size: 10px;

                font-weight: 800;

            }


            .auto-btn.confirm {

                background: #16834a;

                color: white;

            }


            .auto-btn.change {

                background: #172033;

                color: white;

            }


            .auto-btn:disabled {

                opacity: .5;

                cursor: not-allowed;

            }


            .occupied-label {

                background: #eef8f1;

                color: #237444;

                padding: 8px 10px;

                border-radius: 8px;

                font-size: 10px;

                font-weight: 800;

                white-space: nowrap;

            }


            .waiting-case {

                border-left:
                    5px solid #f59e0b;

            }


            .auto-empty {

                padding: 25px;

                text-align: center;

                color: #687386;

                background: #ffffff;

                border: 1px solid #e4e8ee;

                border-radius: 12px;

            }


            /* MODAL */

            #resqReallocationModal {

                display: none;

                position: fixed;

                inset: 0;

                z-index: 99999;

            }


            #resqReallocationModal.show {

                display: block;

            }


            .resq-modal-overlay {

                position: absolute;

                inset: 0;

                background:
                    rgba(0,0,0,.45);

                display: flex;

                align-items: center;

                justify-content: center;

                padding: 20px;

            }


            .resq-modal {

                width: min(
                    600px,
                    100%
                );

                max-height: 85vh;

                overflow-y: auto;

                background: white;

                border-radius: 16px;

                padding: 24px;

                box-shadow:
                    0 20px 60px
                    rgba(0,0,0,.2);

            }


            .resq-modal h2 {

                margin-bottom: 7px;

                color: #172033;

            }


            .resq-modal-subtitle {

                color: #687386;

                font-size: 13px;

                margin-bottom: 18px;

            }


            .resq-current-bed {

                background: #f5f7fa;

                border-radius: 10px;

                padding: 13px;

                margin-bottom: 15px;

                font-size: 12px;

                color: #4f5b6d;

            }


            .resq-available-beds {

                display: grid;

                grid-template-columns:
                    repeat(
                        2,
                        minmax(0,1fr)
                    );

                gap: 10px;

            }


            .resq-bed-option {

                border: 1px solid #dfe4eb;

                background: white;

                border-radius: 10px;

                padding: 13px;

                text-align: left;

                cursor: pointer;

                display: flex;

                flex-direction: column;

                gap: 5px;

            }


            .resq-bed-option:hover {

                border-color: #e63946;

            }


            .resq-bed-option.selected {

                border:
                    2px solid #e63946;

                background: #fff7f7;

            }


            .resq-bed-option strong {

                color: #172033;

                font-size: 13px;

            }


            .resq-bed-option span,

            .resq-bed-option small {

                color: #687386;

                font-size: 10px;

            }


            .resq-no-beds {

                padding: 20px;

                background: #fff7ed;

                color: #9b6813;

                border-radius: 10px;

                font-size: 12px;

            }


            .resq-modal-actions {

                display: flex;

                justify-content: flex-end;

                gap: 10px;

                margin-top: 20px;

            }


            .resq-btn {

                border: 0;

                border-radius: 8px;

                padding: 11px 15px;

                cursor: pointer;

                font-size: 11px;

                font-weight: 800;

            }


            .resq-btn.secondary {

                background: #eef1f5;

                color: #4f5b6d;

            }


            .resq-btn.primary {

                background: #e63946;

                color: white;

            }


            .resq-btn:disabled {

                opacity: .5;

                cursor: not-allowed;

            }


            @media (
                max-width: 850px
            ) {

                .auto-case {

                    grid-template-columns: 1fr;

                }

                .auto-case-actions {

                    justify-content:
                        flex-start;

                }

                .resq-available-beds {

                    grid-template-columns:
                        1fr;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /* =====================================================
       REALTIME
       ===================================================== */

    function startRealtime() {

        if (
            !state.db ||
            !state.hospitalId
        ) {

            return;

        }


        if (state.channel) {

            try {

                state.db.removeChannel(
                    state.channel
                );

            } catch (error) {

                console.warn(
                    error
                );

            }

        }


        state.channel =
            state.db
                .channel(
                    "resq-auto-bed-" +
                    state.hospitalId
                )


                /*
                 * EMERGENCIES
                 */

                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "emergencies",
                        filter:
                            "hospital_id=eq." +
                            state.hospitalId
                    },

                    async function (
                        payload
                    ) {

                        const emergency =
                            payload?.new ||
                            payload?.old;


                        if (emergency) {

                            await handleEmergencyStatusChange(
                                emergency
                            );

                        }


                        await processAutomaticAllocations();

                    }
                )


                /*
                 * BED CHANGES
                 */

                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table:
                            "hospital_resource_slots",
                        filter:
                            "hospital_id=eq." +
                            state.hospitalId
                    },

                    async function () {

                        await processAutomaticAllocations();

                    }
                )


                .subscribe(
                    function (
                        status
                    ) {

                        console.log(
                            "ResQ automatic bed realtime:",
                            status
                        );

                    }
                );

    }


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    async function initialize() {

        if (
            state.initialized
        ) {

            return;

        }


        state.initialized =
            true;


        try {

            injectStyles();

            ensureReallocationModal();


            state.db =
                getSupabase();


            if (!state.db) {

                throw new Error(
                    "Supabase client is unavailable."
                );

            }


            state.user =
                await getCurrentUser();


            if (!state.user) {

                return;

            }


            state.hospitalId =
                await getHospitalId(
                    state.user.id
                );


            if (
                !state.hospitalId
            ) {

                throw new Error(
                    "Hospital account is not assigned to a hospital."
                );

            }


            /*
             * FIRST LOAD
             */

            await processAutomaticAllocations();


            /*
             * REALTIME
             */

            startRealtime();


            /*
             * Backup refresh.
             *
             * If realtime misses an event,
             * the system checks every 10 seconds.
             */

            setInterval(
                function () {

                    processAutomaticAllocations();

                },
                10000
            );


            console.log(
                "===================================="
            );

            console.log(
                "RESQ-ROUTE AUTOMATIC BED SYSTEM ON"
            );

            console.log(
                "Hospital:",
                state.hospitalId
            );

            console.log(
                "===================================="
            );


        } catch (error) {

            console.error(
                "Automatic bed allocation initialization error:",
                error
            );


            showAllocationError(
                error
            );

        }

    }


    /* =====================================================
       START
       ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.resqAutoBedAllocation = {

        refresh:
            processAutomaticAllocations,

        confirm:
            confirmAutomaticAllocation,

        reallocate:
            openReallocationModal,

        getState:
            function () {

                return state;

            }

    };


})();
