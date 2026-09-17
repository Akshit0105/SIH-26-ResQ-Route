/* =========================================================
   ResQ-Route
   Emergency Request & Dispatch Logic
   =========================================================

   Handles:
   1. Emergency form
   2. Patient information
   3. Location detection
   4. Emergency creation
   5. Ambulance dispatch
   6. Hospital selection
   7. Emergency status
   8. Emergency events
   9. Emergency notifications
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const EMERGENCY_CONFIG = {

    emergencyPage: "emergency.html",

    familyDashboard: "family.html",

    ambulanceDashboard: "ambulance.html",

    hospitalDashboard: "hospital.html",

    defaultPriority: "high",

    locationAccuracyRequired: false,

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
   GET SUPABASE CLIENT
   ========================================================= */

function getEmergencySupabase() {

    if (
        typeof window.resqRoute === "undefined" ||
        !window.resqRoute.supabase
    ) {

        console.error(
            "Supabase client is not available."
        );

        return null;
    }

    return window.resqRoute.supabase;
}


/* =========================================================
   INPUT HELPERS
   ========================================================= */

function getEmergencyValue(...ids) {

    for (const id of ids) {

        const element =
            document.getElementById(id);

        if (element) {

            return String(
                element.value || ""
            ).trim();
        }
    }

    return "";
}


function getSelectedRadio(name) {

    const element =
        document.querySelector(
            `input[name="${name}"]:checked`
        );

    return element
        ? element.value
        : null;
}


function getChecked(...ids) {

    for (const id of ids) {

        const element =
            document.getElementById(id);

        if (element) {
            return Boolean(element.checked);
        }
    }

    return false;
}


/* =========================================================
   MESSAGE / NOTIFICATION
   ========================================================= */

function showEmergencyMessage(
    message,
    type = "error"
) {

    let element =
        document.getElementById(
            "emergencyMessage"
        );


    if (!element) {

        element =
            document.getElementById("message");
    }


    if (element) {

        element.textContent =
            message;

        element.style.display =
            "block";

        if (type === "success") {

            element.style.color =
                "#166534";

        } else {

            element.style.color =
                "#991b1b";
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
            "420px";

        notification.style.fontWeight =
            "600";

        notification.style.boxShadow =
            "0 8px 25px rgba(0,0,0,0.15)";

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
        setTimeout(() => {

            notification.style.display =
                "none";

        }, 5000);
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
            "Unable to get user:",
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

    const lat =
        Number(latitude);

    const lng =
        Number(longitude);


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
   GET USER LOCATION
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


            navigator.geolocation.getCurrentPosition(

                function(position) {

                    emergencyLocation = {

                        latitude:
                            Number(
                                position.coords.latitude
                            ),

                        longitude:
                            Number(
                                position.coords.longitude
                            ),

                        accuracy:
                            Number(
                                position.coords.accuracy
                            ),

                        source:
                            "gps",

                        address:
                            null

                    };


                    updateLocationUI();


                    resolve(
                        emergencyLocation
                    );
                },


                function(error) {

                    let message =
                        "Unable to determine your location.";


                    switch (
                        error.code
                    ) {

                        case error.PERMISSION_DENIED:

                            message =
                                "Location permission was denied.";

                            break;


                        case error.POSITION_UNAVAILABLE:

                            message =
                                "Your location is currently unavailable.";

                            break;


                        case error.TIMEOUT:

                            message =
                                "Location request timed out.";

                            break;

                    }


                    reject(
                        new Error(message)
                    );
                },


                {

                    enableHighAccuracy:
                        true,

                    timeout:
                        10000,

                    maximumAge:
                        0

                }
            );

        }
    );
}


/* =========================================================
   UPDATE LOCATION UI
   ========================================================= */

function updateLocationUI() {

    const status =
        document.getElementById(
            "locationStatus"
        );


    const latitude =
        document.getElementById(
            "latitude"
        );


    const longitude =
        document.getElementById(
            "longitude"
        );


    if (latitude) {

        latitude.value =
            emergencyLocation.latitude ??
            "";
    }


    if (longitude) {

        longitude.value =
            emergencyLocation.longitude ??
            "";
    }


    if (status) {

        if (
            emergencyLocation.latitude !== null &&
            emergencyLocation.longitude !== null
        ) {

            status.textContent =
                "Location detected successfully.";

            status.style.color =
                "#166534";

        } else {

            status.textContent =
                "Location not detected.";

            status.style.color =
                "#991b1b";
        }
    }


    const locationText =
        document.getElementById(
            "locationText"
        );


    if (locationText) {

        if (
            emergencyLocation.latitude !== null &&
            emergencyLocation.longitude !== null
        ) {

            locationText.textContent =
                `${emergencyLocation.latitude.toFixed(6)}, ${emergencyLocation.longitude.toFixed(6)}`;

        } else {

            locationText.textContent =
                "Location not available";
        }
    }
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
   FIND PATIENT RECORD
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
        return null;
    }


    if (!userId) {

        throw new Error(
            "A signed-in family account is required to create the patient record."
        );
    }


    try {

        let patient =
            await findPatientForUser(
                userId
            );


        const payload = {

            user_id:
                userId,

            name:
                patientData.name,

            age:
                patientData.age
                    ? Number(patientData.age)
                    : null,

            gender:
                patientData.gender || null,

            blood_group:
                patientData.bloodGroup || null,

            allergies:
                patientData.allergies || null,

            medical_conditions:
                patientData.medicalConditions || null,

            consent_given:
                patientData.consentGiven === true,

            consent_timestamp:
                patientData.consentGiven === true
                    ? new Date().toISOString()
                    : null

        };


        if (patient) {

            const {
                data,
                error
            } = await supabase
                .from("patients")
                .update(payload)
                .eq(
                    "id",
                    patient.id
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
            "Get/create patient error:",
            error
        );

        throw error;
    }
}


/* =========================================================
   CALCULATE DISTANCE
   ========================================================= */

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
            toRadians(Number(lat1))
        ) *
        Math.cos(
            toRadians(Number(lat2))
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


function toRadians(degrees) {

    return (
        Number(degrees) *
        (Math.PI / 180)
    );
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
            .limit(50);


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


        return sorted.length > 0
            ? sorted[0].ambulance
            : null;

    } catch (error) {

        console.error(
            "Ambulance dispatch search failed:",
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
            .limit(50);


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


        /*
         * Current prototype algorithm:
         * nearest emergency-capable hospital.
         *
         * Later:
         * capability + ICU + trauma + ETA +
         * traffic + available resources.
         */

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


        return sorted.length > 0
            ? sorted[0].hospital
            : null;

    } catch (error) {

        console.error(
            "Hospital selection failed:",
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
            "Emergency event creation failed:",
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
                "Notification creation error:",
                error
            );

            return null;
        }


        return data;

    } catch (error) {

        console.error(
            "Notification creation failed:",
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
         * Family / requester notification
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
         * Driver notification
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
         * Hospital staff notification
         *
         * hospital_staff contains the users
         * assigned to the destination hospital.
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

                for (const member of staff) {

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


    /*
     * IMPORTANT:
     *
     * The current database schema requires
     * emergencies.patient_id.
     *
     * Therefore actual emergency creation
     * currently requires an authenticated
     * family/citizen account.
     *
     * Guest emergency creation should later
     * be handled by a secure Edge Function,
     * not by exposing privileged database
     * credentials in this browser.
     */

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
         * 1. Find/create patient
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
         * 2. Find nearest available ambulance
         */

        const ambulance =
            await findAvailableAmbulance(

                emergencyData.location.latitude,

                emergencyData.location.longitude,

                emergencyData.emergencyType,

                emergencyData.priority

            );


        /*
         * 3. Find suitable hospital
         */

        const hospital =
            await findSuitableHospital(

                emergencyData.location.latitude,

                emergencyData.location.longitude,

                emergencyData.emergencyType,

                emergencyData.priority

            );


        /*
         * 4. Determine initial status
         */

        let initialStatus =
            "DISPATCHING";


        if (ambulance) {

            initialStatus =
                "ASSIGNED";
        }


        /*
         * 5. Create emergency
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
         * 6. Create initial event
         */

        await createEmergencyEvent(

            emergency.id,

            "EMERGENCY_CREATED",

            emergencyData.description
                ? `Emergency request created. Details: ${emergencyData.description}`
                : "Emergency request created."

        );


        /*
         * 7. Assign ambulance
         */

        if (ambulance) {

            await createEmergencyEvent(

                emergency.id,

                "AMBULANCE_ASSIGNED",

                `Ambulance ${ambulance.vehicle_number || ambulance.id} assigned.`

            );


            const {
                error:
                    ambulanceUpdateError
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


            if (ambulanceUpdateError) {

                console.error(
                    "Ambulance status update error:",
                    ambulanceUpdateError
                );
            }
        }


        /*
         * 8. Hospital assignment
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
         * 9. Notifications
         */

        await notifyEmergencyParties(

            emergency,

            ambulance,

            hospital

        );


        /*
         * 10. Store active emergency locally
         */

        try {

            localStorage.setItem(

                "resq_active_emergency_id",

                emergency.id

            );

        } catch (storageError) {

            console.warn(
                "Unable to save active emergency locally:",
                storageError
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
            .select(`
                *,
                patients (
                    id,
                    name,
                    age,
                    gender,
                    blood_group,
                    allergies,
                    medical_conditions
                ),
                ambulances (
                    id,
                    vehicle_number,
                    ambulance_type,
                    status,
                    latitude,
                    longitude,
                    driver_id
                ),
                hospitals (
                    id,
                    name,
                    address,
                    latitude,
                    longitude,
                    emergency_available,
                    icu_available,
                    trauma_available,
                    cardiology_available
                )
            `)
            .eq(
                "id",
                emergencyId
            )
            .single();


        if (error) {

            console.error(
                "Emergency retrieval error:",
                error
            );

            return null;
        }


        return data;

    } catch (error) {

        console.error(
            "Emergency retrieval failed:",
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
        !validStatuses.includes(status)
    ) {

        console.error(
            "Invalid emergency status:",
            status
        );

        return false;
    }


    try {

        const {
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
            );


        if (error) {

            console.error(
                "Emergency status update error:",
                error
            );

            return false;
        }


        await createEmergencyEvent(

            emergencyId,

            status,

            description ||
                `Emergency status changed to ${status}.`

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
   GET ACTIVE EMERGENCY FOR CURRENT USER
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
            .select(`
                *,
                patients (*),
                ambulances (*),
                hospitals (*)
            `)
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
   GET ACTIVE EMERGENCY BY LOCAL ID
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
            "Unable to access local storage:",
            error
        );
    }


    if (!emergencyId) {

        return await getActiveEmergencyForUser();
    }


    const emergency =
        await getEmergencyById(
            emergencyId
        );


    if (emergency) {

        return emergency;
    }


    return await getActiveEmergencyForUser();
}


/* =========================================================
   SUBMIT EMERGENCY FORM
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
                    "Dispatching...";
            }


            try {

                /*
                 * Location
                 */

                if (
                    emergencyLocation.latitude === null ||
                    emergencyLocation.longitude === null
                ) {

                    try {

                        await getEmergencyLocation();

                    } catch (locationError) {

                        throw new Error(
                            "Location is required for emergency dispatch. Please enable location access or provide a manual location."
                        );
                    }
                }


                /*
                 * Emergency type
                 */

                const emergencyType =
                    getSelectedRadio(
                        "emergencyType"
                    ) ||
                    getEmergencyValue(
                        "emergencyType"
                    );


                /*
                 * Priority
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
                 * Patient information
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
                            "gender"
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


                /*
                 * Patient name validation
                 */

                if (!patientData.name) {

                    throw new Error(
                        "Please enter the patient's name."
                    );
                }


                /*
                 * Emergency type validation
                 */

                if (!emergencyType) {

                    throw new Error(
                        "Please select the emergency type."
                    );
                }


                /*
                 * Medical consent
                 *
                 * If the checkbox exists,
                 * require it.
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
                 * Emergency details
                 */

                const description =
                    getEmergencyValue(
                        "emergencyDetails",
                        "details",
                        "description",
                        "condition"
                    );


                /*
                 * Create emergency
                 */

                const result =
                    await createEmergency({

                        patient:
                            patientData,

                        emergencyType:
                            emergencyType,

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
                 * Success message
                 */

                let message =
                    "Emergency request created successfully.";


                if (result.ambulance) {

                    message =
                        `Emergency created. Ambulance ${result.ambulance.vehicle_number || ""} has been assigned.`;

                } else {

                    message =
                        "Emergency created. Searching for an available ambulance.";
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
                 * Redirect to family dashboard
                 */

                setTimeout(
                    () => {

                        window.location.replace(
                            EMERGENCY_CONFIG.familyDashboard
                        );

                    },
                    1200
                );

            } catch (error) {

                console.error(
                    "Emergency form error:",
                    error
                );


                showEmergencyMessage(

                    error.message ||
                    "Unable to submit emergency request."

                );

            } finally {

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


    buttons.forEach(button => {

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


                try {

                    await getEmergencyLocation();


                    showEmergencyMessage(

                        "Your current location has been detected.",

                        "success"

                    );

                } catch (error) {

                    showEmergencyMessage(
                        error.message
                    );

                } finally {

                    button.disabled =
                        false;

                    button.textContent =
                        originalText;
                }

            }

        );

    });
}


/* =========================================================
   MANUAL LOCATION INPUT SUPPORT
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
   AUTO LOAD EXISTING PATIENT DATA
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

        name:
            patient.name,

        fullName:
            patient.name,

        patientAge:
            patient.age,

        age:
            patient.age,

        patientGender:
            patient.gender,

        gender:
            patient.gender,

        bloodGroup:
            patient.blood_group,

        blood_group:
            patient.blood_group,

        allergies:
            patient.allergies,

        medicalConditions:
            patient.medical_conditions,

        medical_conditions:
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
   EMERGENCY PAGE INITIALIZATION
   ========================================================= */

document.addEventListener(

    "DOMContentLoaded",

    function() {

        setupEmergencyForm();

        setupLocationButton();

        setupManualLocationInputs();


        /*
         * Only attempt automatic location
         * detection on emergency.html.
         */

        if (
            window.location.pathname
                .toLowerCase()
                .includes("emergency.html")
        ) {

            getEmergencyLocation()
                .catch(() => {

                    updateLocationUI();

                });


            /*
             * If the user is logged in,
             * prefill existing patient data.
             */

            prefillEmergencyPatient()
                .catch(error => {

                    console.warn(
                        "Patient prefill skipped:",
                        error
                    );

                });

        }

    }

);


/* =========================================================
   GLOBAL EMERGENCY API
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
    "ResQ-Route emergency module loaded."
);