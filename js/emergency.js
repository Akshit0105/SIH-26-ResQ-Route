
/* =========================================================
   ResQ-Route Emergency System
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

let emergencyRealtimeChannel = null;


/* =========================================================
   SUPABASE
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
            "Unable to get current user:",
            error
        );

        return null;
    }
}


/* =========================================================
   LOCATION
   ========================================================= */

let emergencyLocation = {

    latitude: null,

    longitude: null,

    accuracy: null,

    source: null,

    address: null

};


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


function getEmergencyLocation() {

    return new Promise(
        function(resolve, reject) {

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


                    if (
                        !isValidCoordinate(
                            emergencyLocation.latitude,
                            emergencyLocation.longitude
                        )
                    ) {

                        reject(
                            new Error(
                                "Invalid location received from browser."
                            )
                        );

                        return;
                    }


                    updateLocationUI();

                    resolve(
                        emergencyLocation
                    );
                },

                function(error) {

                    let message =
                        "Unable to determine your current location.";

                    if (
                        error.code ===
                        error.PERMISSION_DENIED
                    ) {

                        message =
                            "Location permission was denied. Please allow location access and try again.";

                    } else if (
                        error.code ===
                        error.POSITION_UNAVAILABLE
                    ) {

                        message =
                            "Your device could not determine your location.";

                    } else if (
                        error.code ===
                        error.TIMEOUT
                    ) {

                        message =
                            "Location detection timed out.";
                    }

                    reject(
                        new Error(message)
                    );
                },

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


function updateLocationUI() {

    const latitude =
        document.getElementById(
            "latitude"
        );

    const longitude =
        document.getElementById(
            "longitude"
        );

    const status =
        document.getElementById(
            "locationStatus"
        );

    const locationText =
        document.getElementById(
            "locationText"
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


    if (locationText) {

        if (
            emergencyLocation.latitude !== null &&
            emergencyLocation.longitude !== null
        ) {

            locationText.textContent =
                emergencyLocation.latitude.toFixed(6) +
                ", " +
                emergencyLocation.longitude.toFixed(6);

        } else {

            locationText.textContent =
                "Location not available";
        }
    }
}


function setManualLocation(
    latitude,
    longitude,
    source
) {

    const lat =
        Number(latitude);

    const lng =
        Number(longitude);


    if (
        !validCoords(
            latitude,
            longitude
        )
    ) {
        throw new Error(
            "Invalid emergency location."
        );
    }


    emergencyLocation = {

        latitude:
            Number(latitude),

        longitude:
            Number(longitude),

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
   DISTANCE
   ========================================================= */

function toRadians(degrees) {

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
   PATIENT
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


async function getOrCreatePatient(
    userId,
    patientData
) {

    const supabase =
        getEmergencySupabase();


    if (!supabase) {
        return null;
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

        /*
         * IMPORTANT:
         *
         * Do NOT trust ambulance.status alone.
         *
         * An ambulance can accidentally remain
         * "available" in the database while an
         * active emergency is still assigned to it.
         *
         * We therefore first find every ambulance
         * currently attached to an active emergency.
         */

        const activeStatuses = [

            "REPORTED",

            "DISPATCHING",

            "ASSIGNED",

            "DRIVER_ACCEPTED",

            "EN_ROUTE_TO_PATIENT",

            "ARRIVED_AT_PATIENT",

            "PATIENT_ONBOARD",

            "EN_ROUTE_TO_HOSPITAL",

            "ARRIVED_AT_HOSPITAL"

        ];


        const {
            data:
                activeEmergencies,

            error:
                activeEmergencyError

        } = await supabase

            .from("emergencies")

            .select(
                "id,ambulance_id,status"
            )

            .in(
                "status",
                activeStatuses
            )

            .not(
                "ambulance_id",
                "is",
                null
            );


        if (activeEmergencyError) {

            console.error(
                "Active emergency lookup error:",
                activeEmergencyError
            );

            return null;
        }


        /*
         * Create a Set containing the IDs
         * of all busy ambulances.
         */

        const busyAmbulanceIds =
            new Set(

                (
                    activeEmergencies ||
                    []
                )

                    .map(
                        function(emergency) {

                            return String(
                                emergency.ambulance_id ||
                                ""
                            );

                        }
                    )

                    .filter(
                        Boolean
                    )

            );


        /*
         * Now get ambulances whose database
         * status says "available".
         */

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


        /*
         * Remove every ambulance that already
         * has an active emergency.
         */

        const trulyAvailable =
            data.filter(

                function(ambulance) {

                    return !busyAmbulanceIds.has(
                        String(
                            ambulance.id
                        )
                    );

                }

            );


        if (
            trulyAvailable.length === 0
        ) {

            console.log(
                "No ambulance is actually available. All database-available ambulances have active emergencies."
            );

            return null;
        }


        /*
         * Pick the nearest truly available
         * ambulance.
         */

        const sorted =
            trulyAvailable

                .map(

                    function(ambulance) {

                        const distance =
                            calculateDistance(

                                latitude,

                        longitude:
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

                    function(a, b) {

                        return (
                            a.distance -
                            b.distance
                        );

                    }

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

                    function(hospital) {

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

                    function(a, b) {

                        return (
                            a.distance -
                            b.distance
                        );

                    }

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
            "Emergency event creation failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   AUTH
   ========================================================= */

async function createEmergencyNotification(
    userId,
    emergencyId,
    title,
    message,
    notificationType = "emergency"
) {

    const supabase =
        db();

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
        db();


    if (!supabase) {
        return;
    }


    try {

        if (
            emergency.requester_id
        ) {

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


        if (
            hospital &&
            hospital.id
        ) {

            const {
                data: staff,
                error
            } = await supabase

                .from("hospital_staff")

                .select(
                    "user_id"
                )

                .eq(
                    "hospital_id",
                    hospital.id
                );


            if (
                !error &&
                Array.isArray(staff)
            ) {

                for (
                    const member
                    of staff
                ) {

                    if (
                        !member.user_id
                    ) {

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
    data
) {
    const supabase =
        db();


    if (!supabase) {

        throw new Error(
            "Supabase is not configured."
        );
    }


    if (
        !data ||
        !data.emergencyType
    ) {

        throw new Error(
            "Please select the emergency type."
        );
    }


    if (
        !data.location ||
        !validCoords(
            data.location.latitude,
            data.location.longitude
        )
    ) {

        throw new Error(
            "A valid emergency location is required."
        );
    }


    try {

        /*
         * Get patient.
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
         * Find ambulance.
         *
         * The updated function now excludes
         * ambulances already handling another
         * active emergency.
         */

        const ambulance =
            await findAvailableAmbulance(

                emergencyData.location.latitude,

                emergencyData.location.longitude,

                emergencyData.emergencyType,

                emergencyData.priority

            );


        /*
         * Find hospital.
         */

        const hospital =
            await findSuitableHospital(

                emergencyData.location.latitude,

                emergencyData.location.longitude,

                emergencyData.emergencyType,

                emergencyData.priority

            );


        const initialStatus =
            ambulance
                ? "ASSIGNED"
                : "DISPATCHING";


        /*
         * Create emergency row.
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
                        data.location.latitude
                    ),

                p_longitude:
                    Number(
                        data.location.longitude
                    ),

                p_temporary_patient_id:
                    patientId,

                p_person_type:
                    data.personType ||
                    "unknown",

                p_condition:
                    data.condition ||
                    null,

                status:
                    initialStatus

            })

            .select("*")

            .single();


    if (result.error) {

            console.error(
                "Emergency insert error:",
                emergencyError
            );

            throw emergencyError;
        }


        /*
         * Initial event.
         */

        await createEmergencyEvent(

            emergency.id,

            "EMERGENCY_CREATED",

            emergencyData.description
                ? `Emergency request created. Details: ${emergencyData.description}`
                : "Emergency request created."

        );


        /*
         * Assign ambulance.
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
         * Hospital assignment.
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
         * Notify parties.
         */

        await notifyEmergencyParties(

            emergency,

            ambulance,

            hospital

        );


        /*
         * Store active emergency locally.
         */

        try {

            localStorage.setItem(

                "resq_active_emergency_id",

                emergency.id

            );

        } catch (storageError) {

            console.warn(
                "Could not save emergency ID:",
                storageError
            );
        }


    return {

        success:
            true,

        emergencyId:
            rpc.emergency_id,

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
   GET EMERGENCY
   ========================================================= */

async function getEmergencyById(
    id
) {
    const supabase =
        db();


    if (
        !supabase ||
        !id
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
   STATUS UPDATE
   ========================================================= */

async function updateEmergencyStatus(
    id,
    status,
    description
) {
    const supabase =
        db();


    if (
        !supabase ||
        !id ||
        !status
    ) {
        return false;
    }


    const allowed =
        EMERGENCY_CONFIG
            .activeStatuses
            .concat([
                "COMPLETED",
                "CANCELLED"
            ]);


    if (
        !allowed.includes(status)
    ) {

        return false;
    }


    try {

        /*
         * Get ambulance ID together with
         * the updated emergency.
         *
         * This is necessary so we can release
         * the correct ambulance later.
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
                "id,status,updated_at,ambulance_id"
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
         * IMPORTANT:
         *
         * When the emergency ends, release
         * the assigned ambulance.
         *
         * This prevents the ambulance from
         * staying permanently unavailable.
         */

        if (
            status === "CANCELLED" ||
            status === "COMPLETED"
        ) {

            if (
                data.ambulance_id
            ) {

                try {

                    const {
                        error:
                            releaseError

                    } = await supabase

                        .from("ambulances")

                        .update({

                            status:
                                "available"

                        })

                        .eq(
                            "id",
                            data.ambulance_id
                        );


                    if (releaseError) {

                        console.warn(

                            "Emergency status changed, but ambulance could not be released:",

                            releaseError

                        );

                    } else {

                        console.log(

                            "Ambulance released after emergency ended:",

                            data.ambulance_id

                        );

                    }

                } catch (releaseError) {

                    console.warn(

                        "Ambulance release failed:",

                        releaseError

                    );

                }

            }

        }


        /*
         * Event logging should not prevent
         * the actual status update from succeeding.
         */

        try {

            await createEmergencyEvent(

                emergencyId,

                status,

                description:
                    description ||
                    "Emergency status changed to " +
                    status +
                    "."
            });

    } catch (error) {

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
   ACTIVE EMERGENCY FOR CURRENT USER
   ========================================================= */

async function getActiveEmergencyForUser() {

    const supabase =
        db();

    const user =
        await currentUser();


    if (
        !supabase ||
        !user
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


    return result.error
        ? null
        : result.data;
}


/* =========================================================
   STORED ACTIVE EMERGENCY
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
   MESSAGE
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
            document.getElementById(
                "message"
            );
    }


    if (element) {

        element.textContent =
            message;

        element.style.display =
            "block";

        element.style.color =
            type === "success"
                ? "#166534"
                : "#991b1b";

        return;
    }


    let notification =
        document.getElementById(
            "resq-emergency-notification"
        );


    if (!notification) {

        notification =
            document.createElement(
                "div"
            );

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
        setTimeout(

            function() {

                notification.style.display =
                    "none";

            },

            5000

        );
}


/* =========================================================
   EMERGENCY FORM
   ========================================================= */

function getEmergencyValue(
    ...ids
) {

    for (
        const id
        of ids
    ) {

        const element =
            document.getElementById(
                id
            );


        if (element) {

            return String(
                element.value ||
                ""
            ).trim();

        }

    }


    return "";
}


function getSelectedRadio(
    name
) {

    const element =
        document.querySelector(
            `input[name="${name}"]:checked`
        );


    return element
        ? element.value
        : null;
}


function getChecked(
    ...ids
) {

    for (
        const id
        of ids
    ) {

        const element =
            document.getElementById(
                id
            );


        if (element) {

            return Boolean(
                element.checked
            );

        }

    }


    return false;
}


/* =========================================================
   LOCATION BUTTONS
   ========================================================= */

function setupLocation() {

    const buttons =
        document.querySelectorAll(

            "#detectLocation, #getLocation, [data-action='location']"

        );


    buttons.forEach(

        function(button) {

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

                const old =
                    detect.textContent;

                detect.disabled =
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

                    message(
                        "Location detected successfully.",
                        "success"
                    );

                    } catch (error) {

                        showEmergencyMessage(
                            error.message
                        );

                } finally {

                    detect.disabled =
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

        function([
            id,
            value
        ]) {

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
   FORM SUBMISSION
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

                if (
                    emergencyLocation.latitude === null ||
                    emergencyLocation.longitude === null
                ) {

                    await getEmergencyLocation();
                }


                const emergencyType =
                    getSelectedRadio(
                        "emergencyType"
                    ) ||
                    getEmergencyValue(
                        "emergencyType"
                    );


                const priority =
                    getSelectedRadio(
                        "priority"
                    ) ||
                    getEmergencyValue(
                        "priority"
                    ) ||
                    EMERGENCY_CONFIG.defaultPriority;


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


                if (
                    !patientData.name
                ) {

                    throw new Error(
                        "Please enter the patient's name."
                    );
                }


                if (!emergencyType) {

                    throw new Error(
                        "Please select the emergency type."
                    );
                }


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


                const description =
                    getEmergencyValue(

                        "emergencyDetails",

                        "details",

                        "description",

                        "condition"

                    );


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


                let message =
                    "Emergency request created successfully.";


                if (
                    result.ambulance
                ) {

                    message =
                        `Emergency created. Ambulance ${result.ambulance.vehicle_number || ""} has been assigned.`;

                } else {

                    message =
                        "Emergency created. Searching for an available ambulance.";

                }


                if (
                    result.hospital
                ) {

                    message +=
                        ` Destination: ${result.hospital.name}.`;
                }


                showEmergencyMessage(

                    message,

                    "success"

                );


                setTimeout(

                    function() {

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
   INITIALIZATION
   ========================================================= */

document.addEventListener(

    "DOMContentLoaded",

    function() {

        setupEmergencyForm();

        setupLocationButton();

        setupManualLocationInputs();


        if (
            window.location.pathname
                .toLowerCase()
                .includes(
                    "emergency.html"
                )
        ) {

            getEmergencyLocation()

                .then(

                    function(location) {

                        console.log(
                            "Emergency location detected:",
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
        setLocation,

    getOrCreateIdentity:
        getOrCreateEmergencyIdentity,

    create:
        createEmergency,

    getById:
        getEmergencyById,

    getActive:
        getActiveEmergencyForUser,

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


console.log(
    "ResQ-Route emergency.js loaded."
);