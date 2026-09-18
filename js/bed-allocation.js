/* =========================================================
   ResQ-Route
   AUTOMATIC BED ALLOCATION ENGINE
   ---------------------------------------------------------
   Features:
   1. Automatically finds an available bed
   2. Reserves the bed for the emergency
   3. Starts a 90-second confirmation timer
   4. Automatically confirms after 90 seconds
   5. Allows hospital staff to reallocate
   6. Prevents basic double-allocation using conditional updates
   7. Supports multiple emergency requests simultaneously
   8. RESERVED -> OCCUPIED when patient arrives
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       CONFIGURATION
       ===================================================== */

    const BED_ALLOCATION_CONFIG = {

        confirmationSeconds: 90,

        resourceType: "Bed",

        availableStatus: "available",

        reservedStatus: "reserved",

        occupiedStatus: "occupied",

        cancelledStatuses: [
            "COMPLETED",
            "CANCELLED"
        ],

        activeEmergencyStatuses: [
            "REPORTED",
            "DISPATCHING",
            "ASSIGNED",
            "DRIVER_ACCEPTED",
            "EN_ROUTE_TO_PATIENT",
            "ARRIVED_AT_PATIENT",
            "PATIENT_ONBOARD",
            "EN_ROUTE_TO_HOSPITAL",
            "ARRIVED_AT_HOSPITAL"
        ]

    };


    /* =====================================================
       STATE
       ===================================================== */

    const allocationState = {

        supabase: null,

        hospitalId: null,

        currentUser: null,

        pendingAllocations: new Map(),

        realtimeChannel: null,

        initialized: false

    };


    /* =====================================================
       GET SUPABASE
       ===================================================== */

    function getSupabaseClient() {

        if (
            typeof window !== "undefined" &&
            window.resqRoute &&
            window.resqRoute.supabase
        ) {

            return window.resqRoute.supabase;

        }


        if (
            typeof window !== "undefined" &&
            window.supabaseClient
        ) {

            return window.supabaseClient;

        }


        console.error(
            "ResQ-Route: Supabase client not available."
        );

        return null;

    }


    /* =====================================================
       GET CURRENT USER
       ===================================================== */

    async function getCurrentUser() {

        const supabase =
            allocationState.supabase ||
            getSupabaseClient();


        if (!supabase) {

            return null;

        }


        try {

            const result =
                await supabase.auth.getUser();


            if (
                result.error ||
                !result.data ||
                !result.data.user
            ) {

                return null;

            }


            return result.data.user;

        }
        catch (error) {

            console.error(
                "Unable to get current user:",
                error
            );

            return null;

        }

    }


    /* =====================================================
       GET HOSPITAL ID
       ===================================================== */

    async function getHospitalId() {

        if (allocationState.hospitalId) {

            return allocationState.hospitalId;

        }


        const supabase =
            allocationState.supabase ||
            getSupabaseClient();


        if (!supabase) {

            return null;

        }


        const user =
            allocationState.currentUser ||
            await getCurrentUser();


        if (!user) {

            return null;

        }


        allocationState.currentUser =
            user;


        /*
         * First try localStorage.
         */

        const storedHospitalId =
            localStorage.getItem(
                "resq_hospital_id"
            );


        if (storedHospitalId) {

            allocationState.hospitalId =
                storedHospitalId;

            return storedHospitalId;

        }


        /*
         * Try hospital_staff table.
         */

        try {

            const response =
                await supabase
                    .from("hospital_staff")
                    .select(
                        "hospital_id"
                    )
                    .eq(
                        "user_id",
                        user.id
                    )
                    .maybeSingle();


            if (
                !response.error &&
                response.data &&
                response.data.hospital_id
            ) {

                allocationState.hospitalId =
                    response.data.hospital_id;


                localStorage.setItem(
                    "resq_hospital_id",
                    response.data.hospital_id
                );


                return response.data.hospital_id;

            }

        }
        catch (error) {

            console.error(
                "Hospital ID lookup error:",
                error
            );

        }


        /*
         * Try profile metadata.
         */

        const metadata =
            user.user_metadata || {};


        const metadataHospitalId =
            metadata.hospital_id ||
            metadata.hospitalId ||
            null;


        if (metadataHospitalId) {

            allocationState.hospitalId =
                metadataHospitalId;


            localStorage.setItem(
                "resq_hospital_id",
                metadataHospitalId
            );


            return metadataHospitalId;

        }


        return null;

    }


    /* =====================================================
       NORMALIZE STATUS
       ===================================================== */

    function normalizeStatus(status) {

        if (!status) {

            return "available";

        }


        return String(status)
            .trim()
            .toLowerCase()
            .replaceAll(
                "-",
                "_"
            );

    }


    /* =====================================================
       FORMAT TIME
       ===================================================== */

    function formatSeconds(seconds) {

        const safeSeconds =
            Math.max(
                0,
                Number(seconds) || 0
            );


        const minutes =
            Math.floor(
                safeSeconds / 60
            );


        const remainingSeconds =
            safeSeconds % 60;


        return (
            String(minutes).padStart(2, "0") +
            ":" +
            String(remainingSeconds).padStart(2, "0")
        );

    }


    /* =====================================================
       GET PRIORITY SCORE
       ===================================================== */

    function getPriorityScore(priority) {

        const value =
            String(priority || "")
                .trim()
                .toLowerCase();


        if (
            value === "critical" ||
            value === "emergency"
        ) {

            return 4;

        }


        if (value === "high") {

            return 3;

        }


        if (value === "medium") {

            return 2;

        }


        if (value === "low") {

            return 1;

        }


        return 0;

    }


    /* =====================================================
       DETERMINE REQUIRED ROOM TYPE
       ===================================================== */

    function getRequiredRoomTypes(emergency) {

        const type =
            String(
                emergency?.emergency_type ||
                emergency?.emergencyType ||
                ""
            )
                .trim()
                .toLowerCase();


        const priority =
            String(
                emergency?.priority || ""
            )
                .trim()
                .toLowerCase();


        /*
         * If the emergency already contains an explicit
         * required room type, use it.
         */

        const explicitType =
            emergency?.required_room_type ||
            emergency?.requiredRoomType ||
            emergency?.care_level ||
            emergency?.careLevel;


        if (explicitType) {

            return [
                String(explicitType)
                    .trim()
            ];

        }


        /*
         * ICU-type emergencies.
         *
         * This mapping is intentionally simple for the
         * current ResQ-Route prototype.
         */

        if (
            type.includes("cardiac") ||
            type.includes("heart") ||
            type.includes("stroke") ||
            type.includes("respiratory") ||
            type.includes("critical")
        ) {

            return [
                "ICU",
                "Emergency Response"
            ];

        }


        if (
            priority === "critical"
        ) {

            return [
                "ICU",
                "Emergency Response"
            ];

        }


        /*
         * Otherwise Emergency Response is preferred,
         * followed by General Ward.
         */

        return [
            "Emergency Response",
            "General Ward",
            "Other"
        ];

    }


    /* =====================================================
       ROOM TYPE MATCH
       ===================================================== */

    function roomTypeMatches(
        roomType,
        requiredTypes
    ) {

        if (
            !requiredTypes ||
            !requiredTypes.length
        ) {

            return true;

        }


        const current =
            String(roomType || "")
                .trim()
                .toLowerCase();


        return requiredTypes.some(
            function (required) {

                return (
                    current ===
                    String(required)
                        .trim()
                        .toLowerCase()
                );

            }
        );

    }


    /* =====================================================
       FETCH AVAILABLE BEDS
       ===================================================== */

    async function fetchAvailableBeds(
        hospitalId
    ) {

        const supabase =
            allocationState.supabase;


        if (!supabase) {

            throw new Error(
                "Supabase client is not available."
            );

        }


        /*
         * Get rooms first.
         */

        const roomResponse =
            await supabase
                .from("hospital_rooms")
                .select(
                    `
                    id,
                    hospital_id,
                    floor_number,
                    room_number,
                    room_type,
                    status
                    `
                )
                .eq(
                    "hospital_id",
                    hospitalId
                );


        if (roomResponse.error) {

            throw roomResponse.error;

        }


        const rooms =
            roomResponse.data || [];


        if (!rooms.length) {

            return [];

        }


        const roomMap =
            new Map();


        rooms.forEach(
            function (room) {

                roomMap.set(
                    room.id,
                    room
                );

            }
        );


        /*
         * Get beds.
         */

        const bedResponse =
            await supabase
                .from(
                    "hospital_resource_slots"
                )
                .select(
                    `
                    id,
                    hospital_id,
                    room_id,
                    resource_type,
                    slot_code,
                    status,
                    patient_id,
                    emergency_id,
                    notes
                    `
                )
                .eq(
                    "hospital_id",
                    hospitalId
                )
                .eq(
                    "resource_type",
                    BED_ALLOCATION_CONFIG.resourceType
                );


        if (bedResponse.error) {

            throw bedResponse.error;

        }


        const beds =
            bedResponse.data || [];


        return beds
            .filter(
                function (bed) {

                    return (
                        normalizeStatus(
                            bed.status
                        ) ===
                        BED_ALLOCATION_CONFIG.availableStatus
                    );

                }
            )
            .map(
                function (bed) {

                    const room =
                        roomMap.get(
                            bed.room_id
                        );


                    return {

                        ...bed,

                        room:
                            room || null

                    };

                }
            );

    }


    /* =====================================================
       SELECT BEST BED
       ===================================================== */

    function selectBestBed(
        beds,
        emergency
    ) {

        if (!beds || !beds.length) {

            return null;

        }


        const requiredTypes =
            getRequiredRoomTypes(
                emergency
            );


        const priority =
            getPriorityScore(
                emergency?.priority
            );


        const scored =
            beds.map(
                function (bed) {

                    const room =
                        bed.room ||
                        {};


                    let score = 0;


                    /*
                     * Room type suitability.
                     */

                    if (
                        roomTypeMatches(
                            room.room_type,
                            requiredTypes
                        )
                    ) {

                        score += 1000;

                    }


                    /*
                     * Exact preferred room type.
                     */

                    if (
                        requiredTypes.length &&
                        String(
                            room.room_type || ""
                        )
                            .toLowerCase() ===
                        String(
                            requiredTypes[0]
                        )
                            .toLowerCase()
                    ) {

                        score += 500;

                    }


                    /*
                     * Critical cases get priority
                     * for higher-care rooms.
                     */

                    if (
                        priority >= 4 &&
                        String(
                            room.room_type || ""
                        )
                            .toLowerCase() ===
                        "icu"
                    ) {

                        score += 250;

                    }


                    /*
                     * Prefer lower floor number for
                     * predictable routing.
                     */

                    const floor =
                        Number(
                            room.floor_number
                        );


                    if (
                        Number.isFinite(
                            floor
                        )
                    ) {

                        score +=
                            Math.max(
                                0,
                                50 - floor
                            );

                    }


                    return {

                        bed,

                        score

                    };

                }
            );


        scored.sort(
            function (a, b) {

                return (
                    b.score -
                    a.score
                );

            }
        );


        /*
         * Only use a room that matches the requested
         * care type when possible.
         */

        const matching =
            scored.find(
                function (item) {

                    return (
                        roomTypeMatches(
                            item.bed.room?.room_type,
                            requiredTypes
                        )
                    );

                }
            );


        if (matching) {

            return matching.bed;

        }


        /*
         * Fallback to the best available bed.
         */

        return scored[0]
            ? scored[0].bed
            : null;

    }


    /* =====================================================
       CREATE ALLOCATION EVENT
       ===================================================== */

    async function createEmergencyEvent(
        emergencyId,
        eventType,
        description
    ) {

        const supabase =
            allocationState.supabase;


        if (!supabase || !emergencyId) {

            return;

        }


        try {

            await supabase
                .from(
                    "emergency_events"
                )
                .insert({

                    emergency_id:
                        emergencyId,

                    event_type:
                        eventType,

                    description:
                        description,

                    created_by:
                        allocationState.currentUser
                            ? allocationState.currentUser.id
                            : null

                });

        }
        catch (error) {

            console.warn(
                "Emergency event could not be created:",
                error
            );

        }

    }


    /* =====================================================
       RESERVE BED
       ===================================================== */

    async function reserveBed(
        bed,
        emergency,
        source = "AUTO"
    ) {

        const supabase =
            allocationState.supabase;


        if (
            !supabase ||
            !bed ||
            !emergency
        ) {

            throw new Error(
                "Missing bed or emergency information."
            );

        }


        const emergencyId =
            emergency.id;


        const patientId =
            emergency.patient_id ||
            null;


        /*
         * IMPORTANT:
         *
         * The status condition is checked in the
         * UPDATE itself.
         *
         * If another request has already reserved
         * this bed, this update affects zero rows.
         */

        const response =
            await supabase
                .from(
                    "hospital_resource_slots"
                )
                .update({

                    status:
                        BED_ALLOCATION_CONFIG.reservedStatus,

                    patient_id:
                        patientId,

                    emergency_id:
                        emergencyId,

                    notes:
                        source === "AUTO"
                            ? "Automatically reserved by ResQ-Route."
                            : "Manually reallocated by hospital staff."

                })
                .eq(
                    "id",
                    bed.id
                )
                .eq(
                    "hospital_id",
                    allocationState.hospitalId
                )
                .eq(
                    "resource_type",
                    BED_ALLOCATION_CONFIG.resourceType
                )
                .eq(
                    "status",
                    BED_ALLOCATION_CONFIG.availableStatus
                )
                .select(
                    "id,slot_code,status,room_id"
                );


        if (response.error) {

            throw response.error;

        }


        if (
            !response.data ||
            !response.data.length
        ) {

            return {

                success: false,

                reason:
                    "BED_ALREADY_TAKEN"

            };

        }


        /*
         * Allocation history.
         */

        try {

            await supabase
                .from(
                    "resource_allocations"
                )
                .insert({

                    hospital_id:
                        allocationState.hospitalId,

                    resource_slot_id:
                        bed.id,

                    resource_type:
                        BED_ALLOCATION_CONFIG.resourceType,

                    patient_id:
                        patientId,

                    emergency_id:
                        emergencyId,

                    allocated_by:
                        allocationState.currentUser
                            ? allocationState.currentUser.id
                            : null,

                    status:
                        "active",

                    notes:
                        source === "AUTO"
                            ? "AUTO_ALLOCATION"
                            : "MANUAL_REALLOCATION"

                });

        }
        catch (error) {

            console.warn(
                "Allocation history insert failed:",
                error
            );

        }


        await createEmergencyEvent(
            emergencyId,
            source === "AUTO"
                ? "BED_AUTO_RESERVED"
                : "BED_REALLOCATED",
            source === "AUTO"
                ? `${bed.slot_code || "Bed"} automatically reserved. 90-second confirmation window started.`
                : `${bed.slot_code || "Bed"} manually selected by hospital staff.`
        );


        return {

            success: true,

            bed: {
                ...bed,
                status:
                    BED_ALLOCATION_CONFIG.reservedStatus,
                patient_id:
                    patientId,
                emergency_id:
                    emergencyId
            }

        };

    }


    /* =====================================================
       CONFIRM BED
       ===================================================== */

    async function confirmAllocation(
        allocation
    ) {

        if (!allocation) {

            return false;

        }


        const supabase =
            allocationState.supabase;


        const bedId =
            allocation.bedId;


        const emergencyId =
            allocation.emergencyId;


        /*
         * Only the reserved bed belonging to this
         * emergency may be confirmed.
         */

        const response =
            await supabase
                .from(
                    "hospital_resource_slots"
                )
                .update({

                    status:
                        BED_ALLOCATION_CONFIG.reservedStatus,

                    notes:
                        "Bed allocation confirmed by ResQ-Route."

                })
                .eq(
                    "id",
                    bedId
                )
                .eq(
                    "hospital_id",
                    allocationState.hospitalId
                )
                .eq(
                    "resource_type",
                    BED_ALLOCATION_CONFIG.resourceType
                )
                .eq(
                    "status",
                    BED_ALLOCATION_CONFIG.reservedStatus
                )
                .eq(
                    "emergency_id",
                    emergencyId
                )
                .select(
                    "id,status"
                );


        if (response.error) {

            console.error(
                "Confirm allocation error:",
                response.error
            );

            return false;

        }


        if (
            !response.data ||
            !response.data.length
        ) {

            return false;

        }


        await createEmergencyEvent(
            emergencyId,
            "BED_ALLOCATION_CONFIRMED",
            `${allocation.displayId || "Bed"} allocation confirmed.`
        );


        removePendingAllocation(
            emergencyId
        );


        refreshDashboardAfterAllocation();


        return true;

    }


    /* =====================================================
       START TIMER
       ===================================================== */

    function startTimer(
        allocation
    ) {

        if (!allocation) {

            return;

        }


        const emergencyId =
            allocation.emergencyId;


        /*
         * Clear an existing timer for the same
         * emergency first.
         */

        stopTimer(
            emergencyId
        );


        const startTime =
            allocation.reservedAt
                ? new Date(
                    allocation.reservedAt
                ).getTime()
                : Date.now();


        const expiryTime =
            startTime +
            (
                BED_ALLOCATION_CONFIG.confirmationSeconds *
                1000
            );


        allocation.expiryTime =
            expiryTime;


        function tick() {

            const remaining =
                Math.max(
                    0,
                    Math.ceil(
                        (
                            expiryTime -
                            Date.now()
                        ) / 1000
                    )
                );


            allocation.remainingSeconds =
                remaining;


            updateTimerUI(
                allocation
            );


            if (
                remaining <= 0
            ) {

                stopTimer(
                    emergencyId
                );


                autoConfirmAllocation(
                    allocation
                )
                    .catch(
                        function (error) {

                            console.error(
                                "Automatic confirmation failed:",
                                error
                            );

                        }
                    );


                return;

            }


            allocation.timerId =
                setTimeout(
                    tick,
                    1000
                );

        }


        tick();

    }


    /* =====================================================
       STOP TIMER
       ===================================================== */

    function stopTimer(
        emergencyId
    ) {

        const allocation =
            allocationState.pendingAllocations
                .get(
                    emergencyId
                );


        if (
            allocation &&
            allocation.timerId
        ) {

            clearTimeout(
                allocation.timerId
            );

            allocation.timerId =
                null;

        }

    }


    /* =====================================================
       AUTO CONFIRM
       ===================================================== */

    async function autoConfirmAllocation(
        allocation
    ) {

        if (!allocation) {

            return;

        }


        /*
         * Verify that the emergency still exists and
         * the bed is still reserved for it.
         */

        const supabase =
            allocationState.supabase;


        try {

            const response =
                await supabase
                    .from(
                        "hospital_resource_slots"
                    )
                    .select(
                        "id,status,emergency_id,slot_code"
                    )
                    .eq(
                        "id",
                        allocation.bedId
                    )
                    .eq(
                        "hospital_id",
                        allocationState.hospitalId
                    )
                    .maybeSingle();


            if (response.error) {

                throw response.error;

            }


            const bed =
                response.data;


            if (
                !bed ||
                normalizeStatus(
                    bed.status
                ) !==
                BED_ALLOCATION_CONFIG.reservedStatus ||
                bed.emergency_id !==
                allocation.emergencyId
            ) {

                removePendingAllocation(
                    allocation.emergencyId
                );

                return;

            }


            const confirmed =
                await confirmAllocation(
                    allocation
                );


            if (confirmed) {

                showAllocationNotification(
                    `${allocation.displayId} automatically confirmed.`,
                    "success"
                );

            }

        }
        catch (error) {

            console.error(
                "Auto confirmation error:",
                error
            );

        }

    }


    /* =====================================================
       ADD PENDING ALLOCATION
       ===================================================== */

    function addPendingAllocation(
        emergency,
        bed,
        source = "AUTO"
    ) {

        if (
            !emergency ||
            !bed
        ) {

            return null;

        }


        const allocation = {

            emergencyId:
                emergency.id,

            patientId:
                emergency.patient_id ||
                null,

            patientName:
                emergency.patients?.name ||
                emergency.patient?.name ||
                "Emergency Patient",

            priority:
                emergency.priority ||
                "HIGH",

            emergencyType:
                emergency.emergency_type ||
                "-",

            bedId:
                bed.id,

            displayId:
                getBedDisplayId(
                    bed
                ),

            roomType:
                bed.room?.room_type ||
                "-",

            floor:
                bed.room?.floor_number ||
                "-",

            roomNumber:
                bed.room?.room_number ||
                "-",

            source:
                source,

            reservedAt:
                new Date().toISOString(),

            remainingSeconds:
                BED_ALLOCATION_CONFIG.confirmationSeconds,

            timerId:
                null

        };


        allocationState.pendingAllocations.set(
            emergency.id,
            allocation
        );


        startTimer(
            allocation
        );


        renderPendingAllocations();


        return allocation;

    }


    /* =====================================================
       REMOVE PENDING ALLOCATION
       ===================================================== */

    function removePendingAllocation(
        emergencyId
    ) {

        stopTimer(
            emergencyId
        );


        allocationState.pendingAllocations.delete(
            emergencyId
        );


        renderPendingAllocations();

    }


    /* =====================================================
       BED DISPLAY ID
       ===================================================== */

    function getBedDisplayId(
        bed
    ) {

        if (!bed) {

            return "Unknown Bed";

        }


        if (bed.slot_code) {

            return bed.slot_code;

        }


        const room =
            bed.room ||
            {};


        return (
            "F" +
            (
                room.floor_number ??
                "-"
            ) +
            "-R" +
            (
                room.room_number ??
                "-"
            ) +
            "-B" +
            (
                bed.id
                    ? String(bed.id).slice(0, 5)
                    : "-"
            )
        );

    }


    /* =====================================================
       FIND EMERGENCIES NEEDING BED
       ===================================================== */

    async function fetchPendingEmergencies() {

        const supabase =
            allocationState.supabase;


        const hospitalId =
            allocationState.hospitalId;


        if (
            !supabase ||
            !hospitalId
        ) {

            return [];

        }


        const response =
            await supabase
                .from(
                    "emergencies"
                )
                .select(
                    `
                    id,
                    patient_id,
                    hospital_id,
                    emergency_type,
                    priority,
                    status,
                    created_at,
                    patients (
                        id,
                        name,
                        age,
                        gender
                    )
                    `
                )
                .eq(
                    "hospital_id",
                    hospitalId
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


        if (response.error) {

            throw response.error;

        }


        return response.data || [];

    }


    /* =====================================================
       CHECK WHETHER EMERGENCY ALREADY HAS BED
       ===================================================== */

    async function emergencyAlreadyHasBed(
        emergencyId
    ) {

        const supabase =
            allocationState.supabase;


        const response =
            await supabase
                .from(
                    "hospital_resource_slots"
                )
                .select(
                    "id,status,slot_code,emergency_id"
                )
                .eq(
                    "hospital_id",
                    allocationState.hospitalId
                )
                .eq(
                    "resource_type",
                    BED_ALLOCATION_CONFIG.resourceType
                )
                .eq(
                    "emergency_id",
                    emergencyId
                )
                .in(
                    "status",
                    [
                        BED_ALLOCATION_CONFIG.reservedStatus,
                        BED_ALLOCATION_CONFIG.occupiedStatus
                    ]
                )
                .limit(
                    1
                );


        if (response.error) {

            console.error(
                "Existing bed lookup error:",
                response.error
            );

            return false;

        }


        return Boolean(
            response.data &&
            response.data.length
        );

    }


    /* =====================================================
       AUTOMATICALLY ALLOCATE ONE EMERGENCY
       ===================================================== */

    async function automaticallyAllocateEmergency(
        emergency
    ) {

        if (
            !emergency ||
            !emergency.id
        ) {

            return null;

        }


        /*
         * Don't allocate completed/cancelled cases.
         */

        const status =
            String(
                emergency.status || ""
            )
                .trim()
                .toUpperCase();


        if (
            BED_ALLOCATION_CONFIG
                .cancelledStatuses
                .includes(
                    status
                )
        ) {

            return null;

        }


        /*
         * Don't allocate the same emergency twice.
         */

        if (
            allocationState.pendingAllocations.has(
                emergency.id
            )
        ) {

            return allocationState.pendingAllocations.get(
                emergency.id
            );

        }


        const alreadyHasBed =
            await emergencyAlreadyHasBed(
                emergency.id
            );


        if (alreadyHasBed) {

            return null;

        }


        const beds =
            await fetchAvailableBeds(
                allocationState.hospitalId
            );


        if (!beds.length) {

            showAllocationNotification(
                "No suitable bed is currently available.",
                "error"
            );


            return null;

        }


        const bed =
            selectBestBed(
                beds,
                emergency
            );


        if (!bed) {

            return null;

        }


        const reservation =
            await reserveBed(
                bed,
                emergency,
                "AUTO"
            );


        /*
         * Another emergency may have taken this bed
         * milliseconds earlier.
         */

        if (
            !reservation ||
            !reservation.success
        ) {

            /*
             * Retry once with the latest bed list.
             */

            const retryBeds =
                await fetchAvailableBeds(
                    allocationState.hospitalId
                );


            const retryBed =
                selectBestBed(
                    retryBeds,
                    emergency
                );


            if (!retryBed) {

                return null;

            }


            const retryReservation =
                await reserveBed(
                    retryBed,
                    emergency,
                    "AUTO"
                );


            if (
                !retryReservation ||
                !retryReservation.success
            ) {

                return null;

            }


            return addPendingAllocation(
                emergency,
                retryReservation.bed,
                "AUTO"
            );

        }


        return addPendingAllocation(
            emergency,
            reservation.bed,
            "AUTO"
        );

    }


    /* =====================================================
       PROCESS ALL PENDING EMERGENCIES
       ===================================================== */

    async function processPendingEmergencies() {

        if (
            !allocationState.hospitalId
        ) {

            return;

        }


        try {

            const emergencies =
                await fetchPendingEmergencies();


            /*
             * Sort by priority first, then creation time.
             */

            emergencies.sort(
                function (a, b) {

                    const priorityDifference =
                        getPriorityScore(
                            b.priority
                        ) -
                        getPriorityScore(
                            a.priority
                        );


                    if (
                        priorityDifference !== 0
                    ) {

                        return priorityDifference;

                    }


                    return (
                        new Date(
                            a.created_at
                        ).getTime() -
                        new Date(
                            b.created_at
                        ).getTime()
                    );

                }
            );


            /*
             * Process sequentially so this browser does
             * not intentionally reserve several beds at
             * the same time.
             */

            for (
                const emergency
                of emergencies
            ) {

                await automaticallyAllocateEmergency(
                    emergency
                );

            }


            renderPendingAllocations();

        }
        catch (error) {

            console.error(
                "Emergency bed processing error:",
                error
            );

        }

    }


    /* =====================================================
       UPDATE TIMER UI
       ===================================================== */

    function updateTimerUI(
        allocation
    ) {

        const timerElements =
            document.querySelectorAll(
                `[data-bed-timer="${allocation.emergencyId}"]`
            );


        timerElements.forEach(
            function (element) {

                element.textContent =
                    formatSeconds(
                        allocation.remainingSeconds
                    );


                element.classList.toggle(
                    "timer-warning",
                    allocation.remainingSeconds <= 30
                );


                element.classList.toggle(
                    "timer-danger",
                    allocation.remainingSeconds <= 10
                );

            }
        );


        const row =
            document.querySelector(
                `[data-bed-allocation="${allocation.emergencyId}"]`
            );


        if (row) {

            const timer =
                row.querySelector(
                    "[data-bed-timer]"
                );


            if (timer) {

                timer.textContent =
                    formatSeconds(
                        allocation.remainingSeconds
                    );

            }

        }

    }


    /* =====================================================
       RENDER PENDING ALLOCATIONS
       ===================================================== */

    function renderPendingAllocations() {

        const container =
            document.getElementById(
                "automaticBedAllocations"
            );


        if (!container) {

            return;

        }


        const allocations =
            Array.from(
                allocationState
                    .pendingAllocations
                    .values()
            );


        /*
         * Sort by priority.
         */

        allocations.sort(
            function (a, b) {

                return (
                    getPriorityScore(
                        b.priority
                    ) -
                    getPriorityScore(
                        a.priority
                    )
                );

            }
        );


        if (!allocations.length) {

            container.innerHTML = `
                <div class="bed-allocation-empty">
                    No pending automatic bed allocations.
                </div>
            `;

            return;

        }


        container.innerHTML =
            allocations
                .map(
                    function (allocation) {

                        return `
                            <div
                                class="automatic-bed-row"
                                data-bed-allocation="${escapeHtml(
                                    allocation.emergencyId
                                )}"
                            >

                                <div class="bed-patient-info">

                                    <strong>
                                        ${escapeHtml(
                                            allocation.patientName
                                        )}
                                    </strong>

                                    <span>
                                        ${escapeHtml(
                                            allocation.emergencyType
                                        )}
                                    </span>

                                </div>


                                <div class="bed-priority">
                                    <span class="priority-badge ${priorityClass(
                                        allocation.priority
                                    )}">
                                        ${escapeHtml(
                                            String(
                                                allocation.priority
                                            ).toUpperCase()
                                        )}
                                    </span>
                                </div>


                                <div class="bed-auto-location">

                                    <strong>
                                        ${escapeHtml(
                                            allocation.displayId
                                        )}
                                    </strong>

                                    <span>
                                        ${escapeHtml(
                                            allocation.roomType
                                        )}
                                        • Floor
                                        ${escapeHtml(
                                            allocation.floor
                                        )}
                                    </span>

                                </div>


                                <div class="bed-confirm-timer">

                                    <small>
                                        Auto confirmation in
                                    </small>

                                    <strong
                                        data-bed-timer="${escapeHtml(
                                            allocation.emergencyId
                                        )}"
                                    >
                                        ${formatSeconds(
                                            allocation.remainingSeconds
                                        )}
                                    </strong>

                                </div>


                                <div class="bed-actions">

                                    <button
                                        type="button"
                                        class="bed-confirm-btn"
                                        data-confirm-bed="${escapeHtml(
                                            allocation.emergencyId
                                        )}"
                                    >
                                        ✓ Confirm
                                    </button>

                                    <button
                                        type="button"
                                        class="bed-reallocate-btn"
                                        data-reallocate-bed="${escapeHtml(
                                            allocation.emergencyId
                                        )}"
                                    >
                                        ⇄ Reallocate
                                    </button>

                                </div>

                            </div>
                        `;

                    }
                )
                .join("");


        attachAllocationButtons();

    }


    /* =====================================================
       ATTACH BUTTONS
       ===================================================== */

    function attachAllocationButtons() {

        document
            .querySelectorAll(
                "[data-confirm-bed]"
            )
            .forEach(
                function (button) {

                    button.onclick =
                        async function () {

                            const emergencyId =
                                button.dataset
                                    .confirmBed;


                            const allocation =
                                allocationState
                                    .pendingAllocations
                                    .get(
                                        emergencyId
                                    );


                            if (!allocation) {

                                return;

                            }


                            button.disabled =
                                true;


                            button.textContent =
                                "Confirming...";


                            const confirmed =
                                await confirmAllocation(
                                    allocation
                                );


                            if (!confirmed) {

                                button.disabled =
                                    false;

                                button.textContent =
                                    "✓ Confirm";

                                showAllocationNotification(
                                    "Unable to confirm this allocation. The bed may have changed.",
                                    "error"
                                );

                            }

                        };

                }
            );


        document
            .querySelectorAll(
                "[data-reallocate-bed]"
            )
            .forEach(
                function (button) {

                    button.onclick =
                        function () {

                            const emergencyId =
                                button.dataset
                                    .reallocateBed;


                            openReallocationModal(
                                emergencyId
                            );

                        };

                }
            );

    }


    /* =====================================================
       REALLOCATION MODAL
       ===================================================== */

    function getOrCreateReallocationModal() {

        let modal =
            document.getElementById(
                "bedReallocationModal"
            );


        if (modal) {

            return modal;

        }


        modal =
            document.createElement(
                "div"
            );


        modal.id =
            "bedReallocationModal";


        modal.className =
            "bed-reallocation-modal";


        modal.innerHTML = `

            <div class="bed-reallocation-dialog">

                <div class="bed-reallocation-header">

                    <div>

                        <h3>
                            Change Bed Allocation
                        </h3>

                        <p>
                            Select another suitable available bed.
                        </p>

                    </div>

                    <button
                        type="button"
                        data-close-reallocation
                    >
                        ×
                    </button>

                </div>


                <div
                    class="bed-current-allocation"
                    id="currentBedAllocation"
                ></div>


                <div
                    class="bed-reallocation-list"
                    id="reallocationBedList"
                >

                    Loading available beds...

                </div>


                <div class="bed-reallocation-actions">

                    <button
                        type="button"
                        class="bed-cancel-reallocation"
                        data-close-reallocation
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        class="bed-save-reallocation"
                        id="saveBedReallocation"
                    >
                        Confirm Reallocation
                    </button>

                </div>

            </div>

        `;


        document.body.appendChild(
            modal
        );


        /*
         * Add styles dynamically.
         */

        addReallocationStyles();


        modal
            .querySelectorAll(
                "[data-close-reallocation]"
            )
            .forEach(
                function (button) {

                    button.onclick =
                        closeReallocationModal;

                }
            );


        return modal;

    }


    /* =====================================================
       OPEN REALLOCATION MODAL
       ===================================================== */

    async function openReallocationModal(
        emergencyId
    ) {

        const allocation =
            allocationState
                .pendingAllocations
                .get(
                    emergencyId
                );


        if (!allocation) {

            return;

        }


        const modal =
            getOrCreateReallocationModal();


        modal.classList.add(
            "active"
        );


        const current =
            document.getElementById(
                "currentBedAllocation"
            );


        const list =
            document.getElementById(
                "reallocationBedList"
            );


        const saveButton =
            document.getElementById(
                "saveBedReallocation"
            );


        if (current) {

            current.innerHTML = `
                <strong>Current allocation</strong>
                <span>
                    ${escapeHtml(
                        allocation.displayId
                    )}
                    •
                    ${escapeHtml(
                        allocation.roomType
                    )}
                    • Floor
                    ${escapeHtml(
                        allocation.floor
                    )}
                </span>
            `;

        }


        if (list) {

            list.innerHTML =
                "Loading available suitable beds...";

        }


        let selectedBedId =
            null;


        try {

            const beds =
                await fetchAvailableBeds(
                    allocationState.hospitalId
                );


            /*
             * We need the emergency object again so
             * the same suitability rules are applied.
             */

            const emergency =
                await getEmergencyById(
                    emergencyId
                );


            const suitableBeds =
                beds.filter(
                    function (bed) {

                        const required =
                            getRequiredRoomTypes(
                                emergency || {
                                    priority:
                                        allocation.priority,
                                    emergency_type:
                                        allocation.emergencyType
                                }
                            );


                        return roomTypeMatches(
                            bed.room?.room_type,
                            required
                        );

                    }
                );


            if (!suitableBeds.length) {

                if (list) {

                    list.innerHTML = `
                        <div class="no-reallocation-beds">
                            No other suitable available beds
                            are currently available.
                        </div>
                    `;

                }


                if (saveButton) {

                    saveButton.disabled =
                        true;

                }


                return;

            }


            if (saveButton) {

                saveButton.disabled =
                    false;

            }


            if (list) {

                list.innerHTML =
                    suitableBeds
                        .map(
                            function (bed) {

                                const displayId =
                                    getBedDisplayId(
                                        bed
                                    );


                                return `
                                    <label class="reallocation-bed-option">

                                        <input
                                            type="radio"
                                            name="reallocationBed"
                                            value="${escapeHtml(
                                                bed.id
                                            )}"
                                        >

                                        <span>

                                            <strong>
                                                ${escapeHtml(
                                                    displayId
                                                )}
                                            </strong>

                                            <small>
                                                ${escapeHtml(
                                                    bed.room?.room_type ||
                                                    "Bed"
                                                )}
                                                • Floor
                                                ${escapeHtml(
                                                    bed.room?.floor_number ??
                                                    "-"
                                                )}
                                                • Room
                                                ${escapeHtml(
                                                    bed.room?.room_number ??
                                                    "-"
                                                )}
                                            </small>

                                        </span>

                                    </label>
                                `;

                            }
                        )
                        .join("");


                list
                    .querySelectorAll(
                        'input[name="reallocationBed"]'
                    )
                    .forEach(
                        function (radio) {

                            radio.addEventListener(
                                "change",
                                function () {

                                    selectedBedId =
                                        radio.value;

                                }
                            );

                        }
                    );

            }


            if (saveButton) {

                saveButton.onclick =
                    async function () {

                        if (!selectedBedId) {

                            alert(
                                "Please select another bed."
                            );

                            return;

                        }


                        saveButton.disabled =
                            true;


                        saveButton.textContent =
                            "Reallocating...";


                        try {

                            const result =
                                await reallocateBed(
                                    allocation,
                                    selectedBedId
                                );


                            if (result.success) {

                                closeReallocationModal();


                                showAllocationNotification(
                                    `Bed changed to ${result.newBed.displayId}.`,
                                    "success"
                                );

                            }
                            else {

                                alert(
                                    result.message ||
                                    "Unable to reallocate the bed."
                                );

                            }

                        }
                        catch (error) {

                            console.error(
                                "Reallocation error:",
                                error
                            );


                            alert(
                                error.message ||
                                "Unable to reallocate the bed."
                            );

                        }
                        finally {

                            saveButton.disabled =
                                false;


                            saveButton.textContent =
                                "Confirm Reallocation";

                        }

                    };

            }

        }
        catch (error) {

            console.error(
                "Unable to load reallocation beds:",
                error
            );


            if (list) {

                list.innerHTML = `
                    <div class="no-reallocation-beds">
                        Unable to load available beds.
                    </div>
                `;

            }

        }

    }


    /* =====================================================
       GET EMERGENCY
       ===================================================== */

    async function getEmergencyById(
        emergencyId
    ) {

        const supabase =
            allocationState.supabase;


        const response =
            await supabase
                .from(
                    "emergencies"
                )
                .select(
                    `
                    id,
                    patient_id,
                    emergency_type,
                    priority,
                    status,
                    hospital_id
                    `
                )
                .eq(
                    "id",
                    emergencyId
                )
                .maybeSingle();


        if (response.error) {

            throw response.error;

        }


        return response.data;

    }


    /* =====================================================
       REALLOCATE BED
       ===================================================== */

    async function reallocateBed(
        allocation,
        newBedId
    ) {

        const supabase =
            allocationState.supabase;


        if (
            !allocation ||
            !newBedId
        ) {

            return {

                success: false,

                message:
                    "Invalid allocation."

            };

        }


        /*
         * First reserve the new bed.
         *
         * The new bed must still be available.
         */

        const newBedResponse =
            await supabase
                .from(
                    "hospital_resource_slots"
                )
                .update({

                    status:
                        BED_ALLOCATION_CONFIG.reservedStatus,

                    patient_id:
                        allocation.patientId,

                    emergency_id:
                        allocation.emergencyId,

                    notes:
                        "Manually reallocated during 90-second confirmation window."

                })
                .eq(
                    "id",
                    newBedId
                )
                .eq(
                    "hospital_id",
                    allocationState.hospitalId
                )
                .eq(
                    "resource_type",
                    BED_ALLOCATION_CONFIG.resourceType
                )
                .eq(
                    "status",
                    BED_ALLOCATION_CONFIG.availableStatus
                )
                .select(
                    `
                    id,
                    slot_code,
                    room_id,
                    status
                    `
                );


        if (newBedResponse.error) {

            throw newBedResponse.error;

        }


        if (
            !newBedResponse.data ||
            !newBedResponse.data.length
        ) {

            return {

                success: false,

                message:
                    "That bed is no longer available. Please choose another bed."

            };

        }


        const newBed =
            newBedResponse.data[0];


        /*
         * Get room information.
         */

        const roomResponse =
            await supabase
                .from(
                    "hospital_rooms"
                )
                .select(
                    `
                    id,
                    floor_number,
                    room_number,
                    room_type
                    `
                )
                .eq(
                    "id",
                    newBed.room_id
                )
                .maybeSingle();


        const room =
            roomResponse.data ||
            null;


        const displayId =
            getBedDisplayId({

                ...newBed,

                room:
                    room

            });


        /*
         * Release old reserved bed.
         */

        const oldBedResponse =
            await supabase
                .from(
                    "hospital_resource_slots"
                )
                .update({

                    status:
                        BED_ALLOCATION_CONFIG.availableStatus,

                    patient_id:
                        null,

                    emergency_id:
                        null,

                    notes:
                        "Released after manual reallocation."

                })
                .eq(
                    "id",
                    allocation.bedId
                )
                .eq(
                    "hospital_id",
                    allocationState.hospitalId
                )
                .eq(
                    "resource_type",
                    BED_ALLOCATION_CONFIG.resourceType
                )
                .eq(
                    "status",
                    BED_ALLOCATION_CONFIG.reservedStatus
                )
                .eq(
                    "emergency_id",
                    allocation.emergencyId
                );


        if (oldBedResponse.error) {

            /*
             * Roll the new bed back if the old bed could
             * not be released.
             */

            await supabase
                .from(
                    "hospital_resource_slots"
                )
                .update({

                    status:
                        BED_ALLOCATION_CONFIG.availableStatus,

                    patient_id:
                        null,

                    emergency_id:
                        null,

                    notes:
                        "Reservation rollback."

                })
                .eq(
                    "id",
                    newBedId
                )
                .eq(
                    "hospital_id",
                    allocationState.hospitalId
                )
                .eq(
                    "status",
                    BED_ALLOCATION_CONFIG.reservedStatus
                )
                .eq(
                    "emergency_id",
                    allocation.emergencyId
                );


            throw oldBedResponse.error;

        }


        /*
         * Create allocation history.
         */

        try {

            await supabase
                .from(
                    "resource_allocations"
                )
                .insert({

                    hospital_id:
                        allocationState.hospitalId,

                    resource_slot_id:
                        newBedId,

                    resource_type:
                        BED_ALLOCATION_CONFIG.resourceType,

                    patient_id:
                        allocation.patientId,

                    emergency_id:
                        allocation.emergencyId,

                    allocated_by:
                        allocationState.currentUser
                            ? allocationState.currentUser.id
                            : null,

                    status:
                        "active",

                    notes:
                        "MANUAL_REALLOCATION"

                });

        }
        catch (error) {

            console.warn(
                "Reallocation history error:",
                error
            );

        }


        await createEmergencyEvent(
            allocation.emergencyId,
            "BED_REALLOCATED",
            `Bed changed from ${allocation.displayId} to ${displayId}.`
        );


        stopTimer(
            allocation.emergencyId
        );


        allocation.bedId =
            newBedId;


        allocation.displayId =
            displayId;


        allocation.roomType =
            room?.room_type ||
            "-";


        allocation.floor =
            room?.floor_number ||
            "-";


        allocation.roomNumber =
            room?.room_number ||
            "-";


        allocation.reservedAt =
            new Date().toISOString();


        allocation.remainingSeconds =
            BED_ALLOCATION_CONFIG.confirmationSeconds;


        /*
         * Continue the 90-second confirmation period
         * after reallocation.
         */

        startTimer(
            allocation
        );


        renderPendingAllocations();


        refreshDashboardAfterAllocation();


        return {

            success: true,

            newBed: {

                id:
                    newBedId,

                displayId:
                    displayId,

                room:
                    room

            }

        };

    }


    /* =====================================================
       HANDLE EMERGENCY ARRIVAL
       ===================================================== */

    async function handleHospitalArrival(
        emergencyId
    ) {

        const supabase =
            allocationState.supabase;


        if (!supabase || !emergencyId) {

            return false;

        }


        const response =
            await supabase
                .from(
                    "hospital_resource_slots"
                )
                .update({

                    status:
                        BED_ALLOCATION_CONFIG.occupiedStatus,

                    notes:
                        "Patient arrived at hospital and bed occupied."

                })
                .eq(
                    "hospital_id",
                    allocationState.hospitalId
                )
                .eq(
                    "resource_type",
                    BED_ALLOCATION_CONFIG.resourceType
                )
                .eq(
                    "emergency_id",
                    emergencyId
                )
                .eq(
                    "status",
                    BED_ALLOCATION_CONFIG.reservedStatus
                )
                .select(
                    "id,slot_code,status"
                );


        if (response.error) {

            console.error(
                "Hospital arrival bed update error:",
                response.error
            );

            return false;

        }


        if (
            response.data &&
            response.data.length
        ) {

            stopTimer(
                emergencyId
            );


            removePendingAllocation(
                emergencyId
            );


            await createEmergencyEvent(
                emergencyId,
                "BED_OCCUPIED",
                `${response.data[0].slot_code || "Reserved bed"} marked occupied after hospital arrival.`
            );


            refreshDashboardAfterAllocation();


            return true;

        }


        return false;

    }


    /* =====================================================
       HANDLE EMERGENCY CANCELLATION
       ===================================================== */

    async function releaseEmergencyBed(
        emergencyId
    ) {

        const supabase =
            allocationState.supabase;


        if (
            !supabase ||
            !emergencyId
        ) {

            return false;

        }


        const response =
            await supabase
                .from(
                    "hospital_resource_slots"
                )
                .update({

                    status:
                        BED_ALLOCATION_CONFIG.availableStatus,

                    patient_id:
                        null,

                    emergency_id:
                        null,

                    notes:
                        "Released because emergency was cancelled/completed."

                })
                .eq(
                    "hospital_id",
                    allocationState.hospitalId
                )
                .eq(
                    "resource_type",
                    BED_ALLOCATION_CONFIG.resourceType
                )
                .eq(
                    "emergency_id",
                    emergencyId
                )
                .eq(
                    "status",
                    BED_ALLOCATION_CONFIG.reservedStatus
                );


        if (response.error) {

            console.error(
                "Emergency bed release error:",
                response.error
            );

            return false;

        }


        stopTimer(
            emergencyId
        );


        removePendingAllocation(
            emergencyId
        );


        refreshDashboardAfterAllocation();


        return true;

    }


    /* =====================================================
       REALTIME SUBSCRIPTION
       ===================================================== */

    function setupRealtime() {

        const supabase =
            allocationState.supabase;


        if (!supabase) {

            return;

        }


        /*
         * Remove old channel if present.
         */

        if (
            allocationState.realtimeChannel
        ) {

            try {

                supabase.removeChannel(
                    allocationState.realtimeChannel
                );

            }
            catch (error) {

                console.warn(
                    "Unable to remove old allocation channel:",
                    error
                );

            }

        }


        allocationState.realtimeChannel =
            supabase
                .channel(
                    "resq-bed-allocation-" +
                    Date.now()
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "emergencies"
                    },
                    async function (payload) {

                        const emergency =
                            payload.new ||
                            null;


                        if (!emergency) {

                            return;

                        }


                        if (
                            emergency.hospital_id !==
                            allocationState.hospitalId
                        ) {

                            return;

                        }


                        const status =
                            String(
                                emergency.status ||
                                ""
                            )
                                .trim()
                                .toUpperCase();


                        if (
                            BED_ALLOCATION_CONFIG
                                .cancelledStatuses
                                .includes(
                                    status
                                )
                        ) {

                            await releaseEmergencyBed(
                                emergency.id
                            );

                            return;

                        }


                        /*
                         * Give the database a short moment to
                         * finish related inserts/updates.
                         */

                        setTimeout(
                            function () {

                                automaticallyAllocateEmergency(
                                    emergency
                                )
                                    .then(
                                        function () {

                                            renderPendingAllocations();

                                        }
                                    )
                                    .catch(
                                        function (error) {

                                            console.error(
                                                "Realtime automatic allocation error:",
                                                error
                                            );

                                        }
                                    );

                            },
                            300
                        );

                    }
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "hospital_resource_slots"
                    },
                    function (payload) {

                        /*
                         * When a bed changes elsewhere,
                         * refresh our dashboard.
                         */

                        if (
                            payload.new &&
                            payload.new.hospital_id &&
                            payload.new.hospital_id !==
                            allocationState.hospitalId
                        ) {

                            return;

                        }


                        renderPendingAllocations();


                        refreshDashboardAfterAllocation();

                    }
                )
                .subscribe(
                    function (status) {

                        console.log(
                            "Bed allocation realtime status:",
                            status
                        );

                    }
                );

    }


    /* =====================================================
       REFRESH EXISTING DASHBOARD
       ===================================================== */

    function refreshDashboardAfterAllocation() {

        /*
         * Your existing hospital dashboard has its own
         * refresh functions. We call them when available.
         */

        const functionsToCall = [

            "refreshBedInventory",

            "loadBedInventory",

            "refreshBeds",

            "loadHospitalBeds",

            "refreshDashboard",

            "loadDashboardData"

        ];


        functionsToCall.forEach(
            function (functionName) {

                if (
                    typeof window[
                        functionName
                    ] ===
                    "function"
                ) {

                    try {

                        window[
                            functionName
                        ]();

                    }
                    catch (error) {

                        console.warn(
                            functionName +
                            " refresh failed:",
                            error
                        );

                    }

                }

            }
        );

    }


    /* =====================================================
       NOTIFICATION
       ===================================================== */

    function showAllocationNotification(
        message,
        type = "success"
    ) {

        let notification =
            document.getElementById(
                "bedAllocationNotification"
            );


        if (!notification) {

            notification =
                document.createElement(
                    "div"
                );


            notification.id =
                "bedAllocationNotification";


            notification.style.position =
                "fixed";


            notification.style.top =
                "85px";


            notification.style.right =
                "25px";


            notification.style.zIndex =
                "100000";


            notification.style.padding =
                "13px 17px";


            notification.style.borderRadius =
                "10px";


            notification.style.fontSize =
                "12px";


            notification.style.fontWeight =
                "700";


            notification.style.boxShadow =
                "0 8px 25px rgba(0,0,0,.15)";


            document.body.appendChild(
                notification
            );

        }


        notification.textContent =
            message;


        notification.style.background =
            type === "success"
                ? "#dcfce7"
                : "#fee2e2";


        notification.style.color =
            type === "success"
                ? "#166534"
                : "#991b1b";


        notification.style.display =
            "block";


        clearTimeout(
            notification._hideTimer
        );


        notification._hideTimer =
            setTimeout(
                function () {

                    notification.style.display =
                        "none";

                },
                5000
            );

    }


    /* =====================================================
       ESCAPE HTML
       ===================================================== */

    function escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )
            .replaceAll(
                "&",
                "&amp;"
            )
            .replaceAll(
                "<",
                "&lt;"
            )
            .replaceAll(
                ">",
                "&gt;"
            )
            .replaceAll(
                '"',
                "&quot;"
            )
            .replaceAll(
                "'",
                "&#039;"
            );

    }


    /* =====================================================
       PRIORITY CSS CLASS
       ===================================================== */

    function priorityClass(
        priority
    ) {

        const value =
            String(
                priority || ""
            )
                .toLowerCase();


        if (
            value === "critical"
        ) {

            return "priority-critical";

        }


        if (
            value === "high"
        ) {

            return "priority-high";

        }


        if (
            value === "medium"
        ) {

            return "priority-medium";

        }


        return "priority-low";

    }


    /* =====================================================
       REALLOCATION STYLES
       ===================================================== */

    function addReallocationStyles() {

        if (
            document.getElementById(
                "bedAllocationStyles"
            )
        ) {

            return;

        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "bedAllocationStyles";


        style.textContent = `

            .automatic-bed-row {

                display: grid;

                grid-template-columns:
                    1.2fr
                    .7fr
                    1.2fr
                    .8fr
                    auto;

                gap: 14px;

                align-items: center;

                padding: 14px 16px;

                border-bottom: 1px solid #edf0f4;

                background: white;

            }


            .bed-patient-info {

                display: flex;

                flex-direction: column;

                gap: 4px;

            }


            .bed-patient-info strong {

                font-size: 13px;

            }


            .bed-patient-info span {

                color: #7a8494;

                font-size: 10px;

            }


            .priority-badge {

                display: inline-block;

                padding: 5px 8px;

                border-radius: 999px;

                font-size: 8px;

                font-weight: 900;

            }


            .priority-critical {

                background: #fee2e2;

                color: #b91c1c;

            }


            .priority-high {

                background: #ffedd5;

                color: #c2410c;

            }


            .priority-medium {

                background: #fef3c7;

                color: #a16207;

            }


            .priority-low {

                background: #dcfce7;

                color: #15803d;

            }


            .bed-auto-location {

                display: flex;

                flex-direction: column;

                gap: 4px;

            }


            .bed-auto-location strong {

                font-size: 12px;

            }


            .bed-auto-location span {

                color: #64748b;

                font-size: 9px;

            }


            .bed-confirm-timer {

                text-align: center;

                display: flex;

                flex-direction: column;

                gap: 3px;

            }


            .bed-confirm-timer small {

                color: #64748b;

                font-size: 8px;

            }


            .bed-confirm-timer strong {

                font-size: 18px;

                font-weight: 900;

            }


            .bed-confirm-timer strong.timer-warning {

                color: #c2410c;

            }


            .bed-confirm-timer strong.timer-danger {

                color: #dc2626;

            }


            .bed-actions {

                display: flex;

                gap: 6px;

            }


            .bed-confirm-btn,
            .bed-reallocate-btn {

                border: 0;

                border-radius: 7px;

                padding: 8px 10px;

                font-size: 9px;

                font-weight: 800;

                cursor: pointer;

                white-space: nowrap;

            }


            .bed-confirm-btn {

                background: #172033;

                color: white;

            }


            .bed-reallocate-btn {

                background: #f1f5f9;

                color: #334155;

            }


            .bed-confirm-btn:disabled,
            .bed-reallocate-btn:disabled {

                opacity: .5;

                cursor: not-allowed;

            }


            .bed-allocation-empty {

                padding: 25px;

                text-align: center;

                color: #64748b;

                font-size: 11px;

            }


            .bed-reallocation-modal {

                position: fixed;

                inset: 0;

                background: rgba(15,23,42,.55);

                display: none;

                align-items: center;

                justify-content: center;

                z-index: 99999;

                padding: 20px;

            }


            .bed-reallocation-modal.active {

                display: flex;

            }


            .bed-reallocation-dialog {

                width: min(620px, 100%);

                max-height: 85vh;

                overflow: auto;

                background: white;

                border-radius: 14px;

                box-shadow: 0 20px 60px rgba(0,0,0,.2);

            }


            .bed-reallocation-header {

                padding: 18px 20px;

                border-bottom: 1px solid #edf0f4;

                display: flex;

                justify-content: space-between;

                align-items: flex-start;

            }


            .bed-reallocation-header h3 {

                margin: 0 0 5px;

                font-size: 16px;

            }


            .bed-reallocation-header p {

                margin: 0;

                color: #64748b;

                font-size: 10px;

            }


            .bed-reallocation-header button {

                border: 0;

                background: transparent;

                font-size: 25px;

                cursor: pointer;

                color: #64748b;

            }


            .bed-current-allocation {

                margin: 16px 20px;

                padding: 12px;

                background: #f8fafc;

                border: 1px solid #e2e8f0;

                border-radius: 9px;

                display: flex;

                flex-direction: column;

                gap: 5px;

                font-size: 11px;

            }


            .bed-current-allocation span {

                color: #64748b;

            }


            .bed-reallocation-list {

                padding: 0 20px 15px;

                display: flex;

                flex-direction: column;

                gap: 8px;

            }


            .reallocation-bed-option {

                display: flex;

                align-items: center;

                gap: 10px;

                padding: 12px;

                border: 1px solid #e2e8f0;

                border-radius: 9px;

                cursor: pointer;

            }


            .reallocation-bed-option:hover {

                border-color: #ef3340;

                background: #fffafa;

            }


            .reallocation-bed-option input {

                width: auto;

            }


            .reallocation-bed-option span {

                display: flex;

                flex-direction: column;

                gap: 3px;

            }


            .reallocation-bed-option strong {

                font-size: 11px;

            }


            .reallocation-bed-option small {

                color: #64748b;

                font-size: 9px;

            }


            .no-reallocation-beds {

                padding: 20px;

                text-align: center;

                color: #64748b;

                font-size: 11px;

            }


            .bed-reallocation-actions {

                padding: 15px 20px;

                border-top: 1px solid #edf0f4;

                display: flex;

                justify-content: flex-end;

                gap: 8px;

            }


            .bed-cancel-reallocation,
            .bed-save-reallocation {

                border: 0;

                border-radius: 8px;

                padding: 10px 14px;

                font-size: 10px;

                font-weight: 800;

                cursor: pointer;

            }


            .bed-cancel-reallocation {

                background: #f1f5f9;

                color: #334155;

            }


            .bed-save-reallocation {

                background: #172033;

                color: white;

            }


            .bed-save-reallocation:disabled {

                opacity: .5;

                cursor: not-allowed;

            }


            @media (max-width: 900px) {

                .automatic-bed-row {

                    grid-template-columns: 1fr 1fr;

                }


                .bed-actions {

                    grid-column: 1 / -1;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    async function initialize() {

        if (
            allocationState.initialized
        ) {

            return;

        }


        const supabase =
            getSupabaseClient();


        if (!supabase) {

            console.warn(
                "Bed allocation engine waiting for Supabase."
            );

            return;

        }


        allocationState.supabase =
            supabase;


        allocationState.currentUser =
            await getCurrentUser();


        allocationState.hospitalId =
            await getHospitalId();


        if (
            !allocationState.hospitalId
        ) {

            console.warn(
                "Bed allocation engine: hospital ID not found."
            );

            return;

        }


        allocationState.initialized =
            true;


        addReallocationStyles();


        setupRealtime();


        /*
         * Process existing emergencies immediately.
         */

        await processPendingEmergencies();


        renderPendingAllocations();


        console.log(
            "ResQ-Route automatic bed allocation initialized."
        );

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.resqBedAllocation = {

        initialize:

            initialize,

        process:

            processPendingEmergencies,

        confirm:

            async function (
                emergencyId
            ) {

                const allocation =
                    allocationState
                        .pendingAllocations
                        .get(
                            emergencyId
                        );


                if (!allocation) {

                    return false;

                }


                return confirmAllocation(
                    allocation
                );

            },

        reallocate:

            reallocateBed,

        hospitalArrival:

            handleHospitalArrival,

        release:

            releaseEmergencyBed,

        getPending:

            function () {

                return Array.from(
                    allocationState
                        .pendingAllocations
                        .values()
                );

            },

        getState:

            function () {

                return allocationState;

            }

    };


    /* =====================================================
       DOM READY
       ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize
        );

    }
    else {

        initialize();

    }


})();