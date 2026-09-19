
/* =========================================================
   ResQ-Route - Emergency System
   ========================================================= */

const EMERGENCY_CONFIG = {
    emergencyPage: "emergency.html",
    familyDashboard: "family.html",
    ambulanceDashboard: "ambulance.html",
    hospitalDashboard: "hospital.html",

    defaultPriority: "high",

    activeStatuses: [
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


/* =========================================================
   SUPABASE
   ========================================================= */

function getEmergencySupabase() {
    if (
        typeof window.resqRoute === "undefined" ||
        !window.resqRoute.supabase
    ) {
        console.error("ResQ-Route Supabase client is not available.");
        return null;
    }

    return window.resqRoute.supabase;
}


/* =========================================================
   INPUT HELPERS
   ========================================================= */

function getEmergencyValue(...ids) {
    for (const id of ids) {
        const element = document.getElementById(id);

        if (element) {
            return String(element.value || "").trim();
        }
    }

    return "";
}


function getSelectedRadio(name) {
    const element = document.querySelector(
        `input[name="${name}"]:checked`
    );

    return element ? element.value : null;
}


function getChecked(...ids) {
    for (const id of ids) {
        const element = document.getElementById(id);

        if (element) {
            return Boolean(element.checked);
        }
    }

    return false;
}


/* =========================================================
   MESSAGE
   ========================================================= */

function showEmergencyMessage(message, type = "error") {
    let element =
        document.getElementById("emergencyMessage");

    if (!element) {
        element =
            document.getElementById("message");
    }

    if (element) {
        element.textContent = message;
        element.style.display = "block";

        if (type === "success") {
            element.style.color = "#166534";
        } else {
            element.style.color = "#991b1b";
        }

        return;
    }

    let notification =
        document.getElementById(
            "resq-emergency-notification"
        );

    if (!notification) {
        notification =
            document.createElement("div");

        notification.id =
            "resq-emergency-notification";

        notification.style.position =
            "fixed";

        notification.style.top =
            "20px";

        notification.style.right =
            "20px";

        notification.style.zIndex =
            "99999";

        notification.style.padding =
            "15px 20px";

        notification.style.borderRadius =
            "10px";

        notification.style.maxWidth =
            "450px";

        notification.style.fontWeight =
            "600";

        notification.style.boxShadow =
            "0 8px 25px rgba(0,0,0,0.15)";

        document.body.appendChild(
            notification
        );
    }

    notification.textContent = message;

    notification.style.background =
        type === "success"
            ? "#dcfce7"
            : "#fee2e2";

    notification.style.color =
        type === "success"
            ? "#166534"
            : "#991b1b";

    notification.style.display = "block";

    clearTimeout(
        notification._hideTimer
    );

    notification._hideTimer =
        setTimeout(() => {
            notification.style.display =
                "none";
        }, 6000);
}


/* =========================================================
   CURRENT USER
   ========================================================= */

async function getEmergencyUser() {
    const supabase =
        getEmergencySupabase();

    if (!supabase) {
        return null;
    }

    try {
        const {
            data,
            error
        } = await supabase.auth.getUser();

        if (
            error ||
            !data ||
            !data.user
        ) {
            return null;
        }

        return data.user;

    } catch (error) {
        console.error(
            "Unable to get authenticated user:",
            error
        );

        return null;
    }
}


/* =========================================================
   LOCATION STATE
   ========================================================= */

let emergencyLocation = {
    latitude: null,
    longitude: null,
    accuracy: null,
    source: null,
    address: null
};


/* =========================================================
   LOCATION VALIDATION
   ========================================================= */

function isValidCoordinate(
    latitude,
    longitude
) {
    const lat = Number(latitude);
    const lng = Number(longitude);

    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
}


/* =========================================================
   LOCATION UI
   ========================================================= */

function updateLocationUI() {
    const status =
        document.getElementById(
            "locationStatus"
        );

    const latitudeInput =
        document.getElementById(
            "latitude"
        );

    const longitudeInput =
        document.getElementById(
            "longitude"
        );

    const locationText =
        document.getElementById(
            "locationText"
        );

    const coordinates =
        document.getElementById(
            "coordinates"
        );

    const locationDot =
        document.getElementById(
            "locationDot"
        );


    if (latitudeInput) {
        latitudeInput.value =
            emergencyLocation.latitude ?? "";
    }


    if (longitudeInput) {
        longitudeInput.value =
            emergencyLocation.longitude ?? "";
    }


    if (
        emergencyLocation.latitude !== null &&
        emergencyLocation.longitude !== null
    ) {
        const lat =
            Number(
                emergencyLocation.latitude
            );

        const lng =
            Number(
                emergencyLocation.longitude
            );


        if (status) {
            status.textContent =
                "Location detected successfully.";

            status.style.color =
                "#166534";
        }


        if (locationText) {
            locationText.textContent =
                `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }


        if (coordinates) {
            coordinates.textContent =
                `Latitude: ${lat.toFixed(6)} | Longitude: ${lng.toFixed(6)}`;

            coordinates.classList.add(
                "active"
            );
        }


        if (locationDot) {
            locationDot.classList.add(
                "active"
            );

            locationDot.style.background =
                "#22c55e";
        }

    } else {

        if (status) {
            status.textContent =
                "Location not detected.";

            status.style.color =
                "#991b1b";
        }


        if (locationText) {
            locationText.textContent =
                "Location not available";
        }


        if (coordinates) {
            coordinates.textContent =
                "Coordinates will appear here.";

            coordinates.classList.remove(
                "active"
            );
        }


        if (locationDot) {
            locationDot.classList.remove(
                "active"
            );
        }
    }
}


/* =========================================================
   GET CURRENT LOCATION
   ========================================================= */

function getEmergencyLocation() {
    return new Promise(
        (resolve, reject) => {

            if (!navigator.geolocation) {
                reject(
                    new Error(
                        "Geolocation is not supported by this browser."
                    )
                );

                return;
            }


            let finished = false;


            function success(position) {
                if (finished) {
                    return;
                }


                const latitude =
                    Number(
                        position.coords.latitude
                    );

                const longitude =
                    Number(
                        position.coords.longitude
                    );

                const accuracy =
                    Number(
                        position.coords.accuracy
                    );


                if (
                    !isValidCoordinate(
                        latitude,
                        longitude
                    )
                ) {
                    finished = true;

                    reject(
                        new Error(
                            "The browser returned an invalid location."
                        )
                    );

                    return;
                }


                finished = true;


                emergencyLocation = {
                    latitude:
                        latitude,

                    longitude:
                        longitude,

                    accuracy:
                        accuracy,

                    source:
                        "browser",

                    address:
                        null
                };


                updateLocationUI();


                console.log(
                    "Emergency location detected:",
                    emergencyLocation
                );


                resolve(
                    emergencyLocation
                );
            }


            function firstError(error) {

                if (finished) {
                    return;
                }


                /*
                 * Permission denied means retrying
                 * will not solve the problem.
                 */

                if (
                    error.code ===
                    error.PERMISSION_DENIED
                ) {
                    finished = true;

                    reject(
                        new Error(
                            "Location permission was denied. Allow Location for 127.0.0.1:5500 in Edge and reload the page."
                        )
                    );

                    return;
                }


                /*
                 * Retry without high accuracy.
                 * This is useful on desktops/laptops
                 * without a GPS sensor.
                 */

                navigator.geolocation.getCurrentPosition(

                    success,

                    function(secondError) {

                        if (finished) {
                            return;
                        }


                        finished = true;


                        let message =
                            "Unable to determine your current location.";


                        if (
                            secondError.code ===
                            secondError.PERMISSION_DENIED
                        ) {

                            message =
                                "Location permission was denied. Allow Location for 127.0.0.1:5500 in Edge.";

                        } else if (
                            secondError.code ===
                            secondError.POSITION_UNAVAILABLE
                        ) {

                            message =
                                "Your device/browser could not determine your location. Turn on Windows Location Services.";

                        } else if (
                            secondError.code ===
                            secondError.TIMEOUT
                        ) {

                            message =
                                "Location detection timed out. Turn on Windows Location Services and try again.";
                        }


                        reject(
                            new Error(message)
                        );
                    },

                    {
                        enableHighAccuracy:
                            false,

                        timeout:
                            15000,

                        maximumAge:
                            60000
                    }
                );
            }


            /*
             * First attempt with high accuracy.
             */

            navigator.geolocation.getCurrentPosition(

                success,

                firstError,

                {
                    enableHighAccuracy:
                        true,

                    timeout:
                        15000,

                    maximumAge:
                        0
                }
            );
        }
    );
}


/* =========================================================
   MANUAL LOCATION
   ========================================================= */

function setManualLocation(
    latitude,
    longitude,
    address = null
) {
    const lat =
        Number(latitude);

    const lng =
        Number(longitude);


    if (
        !isValidCoordinate(
            lat,
            lng
        )
    ) {
        throw new Error(
            "Invalid latitude or longitude."
        );
    }


    emergencyLocation = {

        latitude:
            lat,

        longitude:
            lng,

        accuracy:
            null,

        source:
            "manual",

        address:
            address
    };


    updateLocationUI();


    return emergencyLocation;
}


/* =========================================================
   PATIENT LOOKUP
   ========================================================= */

async function findPatientForUser(
    userId
) {
    const supabase =
        getEmergencySupabase();


    if (!supabase) {
        return null;
    }


    try {
        const {
            data,
            error
        } = await supabase
            .from("patients")
            .select("*")
            .eq(
                "user_id",
                userId
            )
            .maybeSingle();


        if (error) {
            console.error(
                "Patient lookup error:",
                error
            );

            return null;
        }


        return data;

    } catch (error) {
        console.error(
            "Patient lookup failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   CREATE / UPDATE PATIENT
   ========================================================= */

async function getOrCreatePatient(
    userId,
    patientData
) {
    const supabase =
        getEmergencySupabase();


    if (!supabase) {
        throw new Error(
            "Supabase is not configured."
        );
    }


    if (!userId) {
        throw new Error(
            "A signed-in family account is required."
        );
    }


    const payload = {

        user_id:
            userId,

        name:
            patientData.name,

        age:
            patientData.age
                ? Number(
                    patientData.age
                )
                : null,

        gender:
            patientData.gender ||
            null,

        blood_group:
            patientData.bloodGroup ||
            null,

        allergies:
            patientData.allergies ||
            null,

        medical_conditions:
            patientData.medicalConditions ||
            null,

        consent_given:
            patientData.consentGiven === true,

        consent_timestamp:
            patientData.consentGiven === true
                ? new Date().toISOString()
                : null
    };


    try {

        const existingPatient =
            await findPatientForUser(
                userId
            );


        if (existingPatient) {

            const {
                data,
                error
            } = await supabase
                .from("patients")
                .update(payload)
                .eq(
                    "id",
                    existingPatient.id
                )
                .select("*")
                .single();


            if (error) {
                console.error(
                    "Patient update error:",
                    error
                );

                throw error;
            }


            return data;
        }


        const {
            data,
            error
        } = await supabase
            .from("patients")
            .insert(payload)
            .select("*")
            .single();


        if (error) {
            console.error(
                "Patient creation error:",
                error
            );

            throw error;
        }


        return data;

    } catch (error) {

        console.error(
            "Get/create patient failed:",
            error
        );

        throw error;
    }
}


/* =========================================================
   DISTANCE
   ========================================================= */

function toRadians(
    degrees
) {
    return (
        Number(degrees) *
        Math.PI /
        180
    );
}


function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {
    if (
        !isValidCoordinate(
            lat1,
            lon1
        ) ||
        !isValidCoordinate(
            lat2,
            lon2
        )
    ) {
        return Infinity;
    }


    const earthRadius =
        6371;


    const dLat =
        toRadians(
            Number(lat2) -
            Number(lat1)
        );


    const dLon =
        toRadians(
            Number(lon2) -
            Number(lon1)
        );


    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(
            toRadians(
                Number(lat1)
            )
        ) *
        Math.cos(
            toRadians(
                Number(lat2)
            )
        ) *
        Math.sin(dLon / 2) ** 2;


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return earthRadius * c;
}


/* =========================================================
   FIND AVAILABLE AMBULANCE
   ========================================================= */

async function findAvailableAmbulance(
    latitude,
    longitude,
    emergencyType = null,
    priority = "high"
) {
    const supabase =
        getEmergencySupabase();


    if (!supabase) {
        return null;
    }


    try {

        const {
            data,
            error
        } = await supabase
            .from("ambulances")
            .select("*")
            .eq(
                "status",
                "available"
            )
            .limit(100);


        if (error) {

            console.error(
                "Ambulance search error:",
                error
            );

            return null;
        }


        if (
            !data ||
            data.length === 0
        ) {
            return null;
        }


        const sorted =
            data
                .map(
                    ambulance => {

                        const distance =
                            calculateDistance(

                                latitude,

                                longitude,

                                ambulance.latitude,

                                ambulance.longitude
                            );


                        return {
                            ambulance:
                                ambulance,

                            distance:
                                distance
                        };
                    }
                )
                .sort(
                    (a, b) =>
                        a.distance -
                        b.distance
                );


        return sorted.length
            ? sorted[0].ambulance
            : null;

    } catch (error) {

        console.error(
            "Ambulance search failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   FIND SUITABLE HOSPITAL
   ========================================================= */

async function findSuitableHospital(
    latitude,
    longitude,
    emergencyType = null,
    priority = "high"
) {
    const supabase =
        getEmergencySupabase();


    if (!supabase) {
        return null;
    }


    try {

        const {
            data,
            error
        } = await supabase
            .from("hospitals")
            .select("*")
            .eq(
                "emergency_available",
                true
            )
            .limit(100);


        if (error) {

            console.error(
                "Hospital search error:",
                error
            );

            return null;
        }


        if (
            !data ||
            data.length === 0
        ) {
            return null;
        }


        const sorted =
            data
                .map(
                    hospital => {

                        const distance =
                            calculateDistance(

                                latitude,

                                longitude,

                                hospital.latitude,

                                hospital.longitude
                            );


                        return {
                            hospital:
                                hospital,

                            distance:
                                distance
                        };
                    }
                )
                .sort(
                    (a, b) =>
                        a.distance -
                        b.distance
                );


        return sorted.length
            ? sorted[0].hospital
            : null;

    } catch (error) {

        console.error(
            "Hospital search failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   CREATE EMERGENCY EVENT
   ========================================================= */

async function createEmergencyEvent(
    emergencyId,
    eventType,
    description
) {
    const supabase =
        getEmergencySupabase();


    if (!supabase) {
        return null;
    }


    try {

        const user =
            await getEmergencyUser();


        const {
            data,
            error
        } = await supabase
            .from("emergency_events")
            .insert({

                emergency_id:
                    emergencyId,

                event_type:
                    eventType,

                description:
                    description,

                created_by:
                    user
                        ? user.id
                        : null
            })
            .select("*")
            .single();


        if (error) {

            console.error(
                "Emergency event error:",
                error
            );

            return null;
        }


        return data;

    } catch (error) {

        console.error(
            "Emergency event failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   CREATE NOTIFICATION
   ========================================================= */

async function createEmergencyNotification(
    userId,
    emergencyId,
    title,
    message,
    notificationType = "emergency"
) {
    const supabase =
        getEmergencySupabase();


    if (
        !supabase ||
        !userId
    ) {
        return null;
    }


    try {

        const {
            data,
            error
        } = await supabase
            .from("notifications")
            .insert({

                user_id:
                    userId,

                emergency_id:
                    emergencyId,

                title:
                    title,

                message:
                    message,

                notification_type:
                    notificationType,

                is_read:
                    false
            })
            .select("*")
            .single();


        if (error) {

            console.error(
                "Notification error:",
                error
            );

            return null;
        }


        return data;

    } catch (error) {

        console.error(
            "Notification failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   NOTIFY EMERGENCY PARTIES
   ========================================================= */

async function notifyEmergencyParties(
    emergency,
    ambulance,
    hospital
) {
    if (!emergency) {
        return;
    }


    const supabase =
        getEmergencySupabase();


    if (!supabase) {
        return;
    }


    try {

        /*
         * Family / requester
         */

        if (emergency.requester_id) {

            await createEmergencyNotification(

                emergency.requester_id,

                emergency.id,

                "Emergency Request Created",

                ambulance
                    ? `Ambulance ${ambulance.vehicle_number || ""} has been assigned.`
                    : "Your emergency request has been received. Ambulance dispatch is in progress.",

                "emergency"

            );
        }


        /*
         * Driver
         */

        if (
            ambulance &&
            ambulance.driver_id
        ) {

            await createEmergencyNotification(

                ambulance.driver_id,

                emergency.id,

                "New Emergency Assignment",

                `Emergency ${String(emergency.id).slice(0, 8)} has been assigned to ambulance ${ambulance.vehicle_number || ""}.`,

                "ambulance_assignment"

            );
        }


        /*
         * Hospital staff
         */

        if (
            hospital &&
            hospital.id
        ) {

            const {
                data: staff,
                error
            } = await supabase
                .from("hospital_staff")
                .select("user_id")
                .eq(
                    "hospital_id",
                    hospital.id
                );


            if (
                !error &&
                Array.isArray(staff)
            ) {

                for (
                    const member of staff
                ) {

                    if (!member.user_id) {
                        continue;
                    }


                    await createEmergencyNotification(

                        member.user_id,

                        emergency.id,

                        "Incoming Emergency Patient",

                        `A new emergency patient has been assigned to ${hospital.name}.`,

                        "hospital_emergency"

                    );
                }
            }
        }

    } catch (error) {

        console.error(
            "Emergency notifications failed:",
            error
        );
    }
}


/* =========================================================
   CREATE EMERGENCY
   ========================================================= */

async function createEmergency(
    emergencyData
) {
    const supabase =
        getEmergencySupabase();


    if (!supabase) {

        throw new Error(
            "Supabase is not configured."
        );
    }


    const user =
        await getEmergencyUser();


    if (!user) {

        throw new Error(
            "Please sign in with a Citizen/Family account before submitting an emergency request."
        );
    }


    if (
        !emergencyData ||
        !emergencyData.patient
    ) {

        throw new Error(
            "Patient information is required."
        );
    }


    if (
        !emergencyData.location ||
        !isValidCoordinate(
            emergencyData.location.latitude,
            emergencyData.location.longitude
        )
    ) {

        throw new Error(
            "A valid emergency location is required."
        );
    }


    try {

        /*
         * STEP 1
         * Create or update patient
         */

        const patient =
            await getOrCreatePatient(

                user.id,

                emergencyData.patient

            );


        if (!patient) {

            throw new Error(
                "Unable to create patient record."
            );
        }


        /*
         * STEP 2
         * Find ambulance
         */

        const ambulance =
            await findAvailableAmbulance(

                emergencyData.location.latitude,

                emergencyData.location.longitude,

                emergencyData.emergencyType,

                emergencyData.priority

            );


        /*
         * STEP 3
         * Find hospital
         */

        const hospital =
            await findSuitableHospital(

                emergencyData.location.latitude,

                emergencyData.location.longitude,

                emergencyData.emergencyType,

                emergencyData.priority

            );


        /*
         * STEP 4
         * Determine status
         */

        const initialStatus =
            ambulance
                ? "ASSIGNED"
                : "DISPATCHING";


        /*
         * STEP 5
         * Insert emergency
         */

        const {
            data: emergency,
            error: emergencyError
        } = await supabase
            .from("emergencies")
            .insert({

                patient_id:
                    patient.id,

                requester_id:
                    user.id,

                emergency_type:
                    emergencyData.emergencyType,

                condition:
                    emergencyData.condition ||
                    null,

                priority:
                    emergencyData.priority ||
                    EMERGENCY_CONFIG.defaultPriority,

                latitude:
                    Number(
                        emergencyData.location.latitude
                    ),

                longitude:
                    Number(
                        emergencyData.location.longitude
                    ),

                ambulance_id:
                    ambulance
                        ? ambulance.id
                        : null,

                hospital_id:
                    hospital
                        ? hospital.id
                        : null,

                status:
                    initialStatus
            })
            .select("*")
            .single();


        if (emergencyError) {

            console.error(
                "Emergency insert error:",
                emergencyError
            );

            throw emergencyError;
        }


        /*
         * STEP 6
         * Initial event
         */

        await createEmergencyEvent(

            emergency.id,

            "EMERGENCY_CREATED",

            [
                emergencyData.condition
                    ? `Condition: ${emergencyData.condition}`
                    : null,

                emergencyData.description
                    ? `Details: ${emergencyData.description}`
                    : null
            ]
                .filter(Boolean)
                .join(" | ") ||
                "Emergency request created."

        );


        /*
         * STEP 7
         * Ambulance assignment
         */

        if (ambulance) {

            await createEmergencyEvent(

                emergency.id,

                "AMBULANCE_ASSIGNED",

                `Ambulance ${ambulance.vehicle_number || ambulance.id} assigned.`

            );


            const {
                error:
                    ambulanceError
            } = await supabase
                .from("ambulances")
                .update({
                    status:
                        "assigned"
                })
                .eq(
                    "id",
                    ambulance.id
                );


            if (ambulanceError) {

                console.error(
                    "Ambulance status update error:",
                    ambulanceError
                );
            }
        }


        /*
         * STEP 8
         * Hospital assignment
         */

        if (hospital) {

            await createEmergencyEvent(

                emergency.id,

                "HOSPITAL_SELECTED",

                `Destination hospital selected: ${hospital.name}.`

            );

        } else {

            await createEmergencyEvent(

                emergency.id,

                "HOSPITAL_SEARCH_PENDING",

                "No emergency-capable hospital was found during initial dispatch."

            );
        }


        /*
         * STEP 9
         * Notifications
         */

        await notifyEmergencyParties(

            emergency,

            ambulance,

            hospital

        );


        /*
         * STEP 10
         * Store emergency ID
         */

        try {

            localStorage.setItem(

                "resq_active_emergency_id",

                emergency.id

            );

        } catch (error) {

            console.warn(
                "Unable to store emergency ID:",
                error
            );
        }


        return {

            success:
                true,

            emergency:
                emergency,

            ambulance:
                ambulance,

            hospital:
                hospital,

            patient:
                patient
        };

    } catch (error) {

        console.error(
            "Emergency creation failed:",
            error
        );

        throw error;
    }
}


/* =========================================================
   GET EMERGENCY BY ID
   ========================================================= */

async function getEmergencyById(
    emergencyId
) {
    const supabase =
        getEmergencySupabase();


    if (
        !supabase ||
        !emergencyId
    ) {
        return null;
    }


    try {

        const {
            data,
            error
        } = await supabase
            .from("emergencies")
            .select("*")
            .eq(
                "id",
                emergencyId
            )
            .single();


        if (error) {

            console.error(
                "Emergency lookup error:",
                error
            );

            return null;
        }


        return data;

    } catch (error) {

        console.error(
            "Emergency lookup failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   UPDATE EMERGENCY STATUS
   ========================================================= */

async function updateEmergencyStatus(
    emergencyId,
    status,
    description = null
) {
    const supabase =
        getEmergencySupabase();


    if (
        !supabase ||
        !emergencyId ||
        !status
    ) {
        return false;
    }


    const validStatuses = [

        "REPORTED",

        "DISPATCHING",

        "ASSIGNED",

        "DRIVER_ACCEPTED",

        "EN_ROUTE_TO_PATIENT",

        "ARRIVED_AT_PATIENT",

        "PATIENT_ONBOARD",

        "EN_ROUTE_TO_HOSPITAL",

        "ARRIVED_AT_HOSPITAL",

        "COMPLETED",

        "CANCELLED"

    ];


    if (
        !validStatuses.includes(
            status
        )
    ) {

        console.error(
            "Invalid emergency status:",
            status
        );

        return false;
    }


    try {

        /*
         * IMPORTANT:
         *
         * This updates the SAME emergency row
         * created by the family/citizen.
         *
         * The ambulance dashboard and hospital
         * dashboard can therefore listen to the
         * same Supabase record.
         */

        const {
            data,
            error
        } = await supabase
            .from("emergencies")
            .update({

                status:
                    status,

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                emergencyId
            )
            .select(
                "id,status,updated_at"
            )
            .single();


        if (error) {

            console.error(
                "Emergency status update error:",
                error
            );

            return false;
        }


        if (
            !data ||
            data.id !== emergencyId ||
            data.status !== status
        ) {

            console.error(
                "Supabase could not confirm emergency status:",
                data
            );

            return false;
        }


        /*
         * Event logging should not prevent the
         * actual status update from succeeding.
         */

        try {

            await createEmergencyEvent(

                emergencyId,

                status,

                description ||
                    `Emergency status changed to ${status}.`

            );

        } catch (eventError) {

            console.warn(
                "Status updated but event logging failed:",
                eventError
            );
        }


        try {

            localStorage.setItem(

                "resq_active_emergency_id",

                emergencyId

            );

        } catch (storageError) {

            console.warn(
                "Could not save emergency ID:",
                storageError
            );
        }


        console.log(
            "Emergency status synchronized:",
            emergencyId,
            "=>",
            status
        );


        return true;

    } catch (error) {

        console.error(
            "Emergency status update failed:",
            error
        );

        return false;
    }
}


/* =========================================================
   GET ACTIVE EMERGENCY
   ========================================================= */

async function getActiveEmergencyForUser() {

    const supabase =
        getEmergencySupabase();


    if (!supabase) {
        return null;
    }


    const user =
        await getEmergencyUser();


    if (!user) {
        return null;
    }


    try {

        const {
            data,
            error
        } = await supabase
            .from("emergencies")
            .select("*")
            .eq(
                "requester_id",
                user.id
            )
            .in(
                "status",
                EMERGENCY_CONFIG.activeStatuses
            )
            .order(
                "created_at",
                {
                    ascending:
                        false
                }
            )
            .limit(1)
            .maybeSingle();


        if (error) {

            console.error(
                "Active emergency lookup error:",
                error
            );

            return null;
        }


        return data;

    } catch (error) {

        console.error(
            "Active emergency lookup failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   GET STORED ACTIVE EMERGENCY
   ========================================================= */

async function getStoredActiveEmergency() {

    let emergencyId =
        null;


    try {

        emergencyId =
            localStorage.getItem(
                "resq_active_emergency_id"
            );

    } catch (error) {

        console.warn(
            "Local storage unavailable:",
            error
        );
    }


    if (emergencyId) {

        const emergency =
            await getEmergencyById(
                emergencyId
            );


        if (emergency) {
            return emergency;
        }
    }


    return await getActiveEmergencyForUser();
}


/* =========================================================
   SETUP EMERGENCY FORM
   ========================================================= */

function setupEmergencyForm() {

    const form =
        document.getElementById(
            "emergencyForm"
        );


    if (!form) {
        return;
    }


    if (
        form.dataset.resqEmergencyBound ===
        "true"
    ) {
        return;
    }


    form.dataset.resqEmergencyBound =
        "true";


    form.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );


            if (submitButton) {

                submitButton.disabled =
                    true;

                submitButton.dataset.originalText =
                    submitButton.textContent;

                submitButton.textContent =
                    "Submitting...";
            }


            try {

                /*
                 * LOCATION
                 */

                if (
                    emergencyLocation.latitude === null ||
                    emergencyLocation.longitude === null
                ) {

                    try {

                        await getEmergencyLocation();

                    } catch (locationError) {

                        throw new Error(
                            "Location is required for emergency dispatch. Please allow location access or enter the location manually."
                        );
                    }
                }


                /*
                 * EMERGENCY TYPE
                 */

                const emergencyType =
                    getSelectedRadio(
                        "emergencyType"
                    ) ||
                    getEmergencyValue(
                        "emergencyType"
                    );


                if (!emergencyType) {

                    throw new Error(
                        "Please select the emergency type."
                    );
                }


                /*
                 * PRIORITY
                 */

                const priority =
                    getSelectedRadio(
                        "priority"
                    ) ||
                    getEmergencyValue(
                        "priority"
                    ) ||
                    EMERGENCY_CONFIG.defaultPriority;


                /*
                 * PATIENT
                 */

                const patientData = {

                    name:
                        getEmergencyValue(
                            "patientName",
                            "name",
                            "fullName"
                        ),

                    age:
                        getEmergencyValue(
                            "patientAge",
                            "age"
                        ),

                    gender:
                        getEmergencyValue(
                            "patientGender",
                            "gender",
                            "patientSex"
                        ),

                    bloodGroup:
                        getEmergencyValue(
                            "bloodGroup",
                            "blood_group"
                        ),

                    allergies:
                        getEmergencyValue(
                            "allergies"
                        ),

                    medicalConditions:
                        getEmergencyValue(
                            "medicalConditions",
                            "medical_conditions"
                        ),

                    consentGiven:
                        getChecked(
                            "medicalConsent"
                        )
                };


                if (
                    !patientData.name
                ) {

                    throw new Error(
                        "Please enter the patient's name."
                    );
                }


                /*
                 * CONSENT
                 */

                const consentElement =
                    document.getElementById(
                        "medicalConsent"
                    );


                if (
                    consentElement &&
                    !consentElement.checked
                ) {

                    throw new Error(
                        "Please provide consent to share the patient's emergency medical information."
                    );
                }


                /*
                 * CURRENT PATIENT CONDITION
                 *
                 * This value is stored on the emergency itself because
                 * a patient's condition can be different for different
                 * emergency incidents.
                 */

                const condition =
                    getEmergencyValue(
                        "patientCondition",
                        "condition",
                        "currentCondition"
                    );


                /*
                 * DESCRIPTION / ADDITIONAL DETAILS
                 */

                const description =
                    getEmergencyValue(
                        "emergencyDetails",
                        "details",
                        "description",
                        "emergencyDescription"
                    );


                /*
                 * CREATE EMERGENCY
                 */

                const result =
                    await createEmergency({

                        patient:
                            patientData,

                        emergencyType:
                            emergencyType,

                        condition:
                            condition,

                        priority:
                            priority,

                        description:
                            description,

                        location:
                            emergencyLocation
                    });


                if (
                    !result ||
                    !result.success
                ) {

                    throw new Error(
                        "Emergency request could not be created."
                    );
                }


                /*
                 * SUCCESS MESSAGE
                 *
                 * IMPORTANT:
                 * There is NO redirect here.
                 */

                let message =
                    "Emergency request has been made successfully.";


                if (result.ambulance) {

                    message =
                        `Emergency request has been made. Ambulance ${result.ambulance.vehicle_number || ""} has been assigned.`;

                } else {

                    message =
                        "Emergency request has been made. Searching for an available ambulance.";
                }


                if (result.hospital) {

                    message +=
                        ` Destination: ${result.hospital.name}.`;
                }


                showEmergencyMessage(
                    message,
                    "success"
                );


                /*
                 * DO NOT REDIRECT.
                 *
                 * The user remains on emergency.html.
                 *
                 * We intentionally do not call:
                 *
                 * window.location.replace(...)
                 */


                if (submitButton) {

                    submitButton.textContent =
                        "REQUEST SUBMITTED";

                    submitButton.disabled =
                        true;
                }


            } catch (error) {

                console.error(
                    "Emergency submission error:",
                    error
                );


                showEmergencyMessage(

                    error.message ||
                    "Unable to submit emergency request."

                );


                if (submitButton) {

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        submitButton.dataset.originalText ||
                        "Request Emergency Assistance";
                }
            }

        }
    );
}


/* =========================================================
   LOCATION BUTTON
   ========================================================= */

function setupLocationButton() {

    const buttons =
        document.querySelectorAll(
            "#detectLocation, #getLocation, [data-action='location']"
        );


    buttons.forEach(
        button => {

            /*
             * emergency.html may already have
             * a location handler.
             *
             * Do not create duplicate handlers.
             */

            if (
                button.dataset.resqLocationBound ===
                "true"
            ) {
                return;
            }


            button.dataset.resqLocationBound =
                "true";


            button.addEventListener(
                "click",
                async function(event) {

                    event.preventDefault();


                    const originalText =
                        button.textContent;


                    button.disabled =
                        true;

                    button.textContent =
                        "Detecting...";


                    const status =
                        document.getElementById(
                            "locationStatus"
                        );


                    if (status) {

                        status.textContent =
                            "Detecting your location...";

                        status.style.color =
                            "";
                    }


                    try {

                        await getEmergencyLocation();


                        showEmergencyMessage(

                            "Your current location has been detected.",

                            "success"

                        );

                    } catch (error) {

                        console.error(
                            "Location detection error:",
                            error
                        );


                        showEmergencyMessage(

                            error.message ||
                            "Unable to detect your location."

                        );

                    } finally {

                        button.disabled =
                            false;

                        button.textContent =
                            originalText;
                    }

                }
            );
        }
    );
}


/* =========================================================
   MANUAL LOCATION
   ========================================================= */

function setupManualLocationInputs() {

    const latitudeInput =
        document.getElementById(
            "latitude"
        );


    const longitudeInput =
        document.getElementById(
            "longitude"
        );


    const manualButton =
        document.getElementById(
            "setManualLocation"
        );


    if (
        !manualButton ||
        !latitudeInput ||
        !longitudeInput
    ) {
        return;
    }


    if (
        manualButton.dataset.resqManualBound ===
        "true"
    ) {
        return;
    }


    manualButton.dataset.resqManualBound =
        "true";


    manualButton.addEventListener(
        "click",
        function(event) {

            event.preventDefault();


            try {

                const address =
                    getEmergencyValue(
                        "address",
                        "locationAddress",
                        "manualAddress"
                    );


                setManualLocation(

                    latitudeInput.value,

                    longitudeInput.value,

                    address || null

                );


                showEmergencyMessage(

                    "Manual emergency location saved.",

                    "success"

                );

            } catch (error) {

                showEmergencyMessage(
                    error.message
                );
            }

        }
    );
}


/* =========================================================
   PREFILL PATIENT
   ========================================================= */

async function prefillEmergencyPatient() {

    const user =
        await getEmergencyUser();


    if (!user) {
        return;
    }


    const patient =
        await findPatientForUser(
            user.id
        );


    if (!patient) {
        return;
    }


    const mappings = {

        patientName:
            patient.name,

        patientAge:
            patient.age,

        patientGender:
            patient.gender,

        patientSex:
            patient.gender,

        bloodGroup:
            patient.blood_group,

        allergies:
            patient.allergies,

        medicalConditions:
            patient.medical_conditions

    };


    Object.entries(
        mappings
    ).forEach(
        ([id, value]) => {

            const element =
                document.getElementById(
                    id
                );


            if (
                element &&
                !element.value &&
                value !== null &&
                value !== undefined
            ) {

                element.value =
                    value;
            }

        }
    );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        setupEmergencyForm();

        setupLocationButton();

        setupManualLocationInputs();


        /*
         * Only perform automatic location
         * detection on emergency.html.
         */

        if (
            window.location.pathname
                .toLowerCase()
                .includes("emergency.html")
        ) {

            getEmergencyLocation()
                .then(
                    function(location) {

                        console.log(
                            "Automatic emergency location detected:",
                            location
                        );
                    }
                )
                .catch(
                    function(error) {

                        console.warn(
                            "Automatic location detection failed:",
                            error
                        );

                        updateLocationUI();
                    }
                );


            prefillEmergencyPatient()
                .catch(
                    function(error) {

                        console.warn(
                            "Patient prefill skipped:",
                            error
                        );
                    }
                );
        }

    }
);


/* =========================================================
   PUBLIC RESQ-ROUTE EMERGENCY API
   ========================================================= */

window.resqEmergency = {

    getLocation:
        getEmergencyLocation,

    setLocation:
        setManualLocation,

    create:
        createEmergency,

    getById:
        getEmergencyById,

    getActive:
        getActiveEmergencyForUser,

    getStoredActive:
        getStoredActiveEmergency,

    updateStatus:
        updateEmergencyStatus,

    addEvent:
        createEmergencyEvent,

    notify:
        createEmergencyNotification,

    notifyParties:
        notifyEmergencyParties,

    findAmbulance:
        findAvailableAmbulance,

    findHospital:
        findSuitableHospital,

    calculateDistance:
        calculateDistance
};


/* =========================================================
   MODULE LOADED
   ========================================================= */

console.log(
    "✓ ResQ-Route emergency.js loaded."
);