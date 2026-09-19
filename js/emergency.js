/* =========================================================
   ResQ-Route Emergency Request Flow
   No signup required for emergency requests.
   ========================================================= */

const EMERGENCY_CONFIG = {
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

let emergencyLocation = {
    latitude: null,
    longitude: null,
    accuracy: null,
    source: null
};

let emergencyRealtimeChannel = null;


/* =========================================================
   SUPABASE
   ========================================================= */

function db() {

    return (
        window.resqRoute &&
        window.resqRoute.supabase
    ) ||
    window.supabaseClient ||
    null;
}


/* =========================================================
   INPUT HELPERS
   ========================================================= */

function value(id) {

    const element =
        document.getElementById(id);

    return element
        ? String(element.value || "").trim()
        : "";
}


function radio(name) {

    const element =
        document.querySelector(
            'input[name="' +
            name +
            '"]:checked'
        );

    return element
        ? element.value
        : "";
}


function personType() {

    return (
        radio("personType") ||
        "unknown"
    );
}


/* =========================================================
   VALIDATION
   ========================================================= */

function validCoords(
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


function escapeHtml(value) {

    return String(
        value == null
            ? ""
            : value
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   MESSAGES
   ========================================================= */

function message(
    text,
    type
) {

    const element =
        document.getElementById(
            "statusMessage"
        );

    if (!element) {
        return;
    }

    element.textContent =
        text;

    element.className =
        "message show " +
        (
            type === "success"
                ? "success"
                : "error"
        );
}


function clearMessage() {

    const element =
        document.getElementById(
            "statusMessage"
        );

    if (element) {

        element.textContent =
            "";

        element.className =
            "message";
    }
}


/* =========================================================
   TEMPORARY PATIENT ID
   ========================================================= */

function temporaryPatientId() {

    let id = null;

    try {

        id =
            sessionStorage.getItem(
                "resq_temporary_patient_id"
            );

    } catch (error) {

        console.warn(
            "Session storage unavailable.",
            error
        );
    }


    if (
        !/^PAT-[A-Z0-9]{6}$/.test(
            id || ""
        )
    ) {

        const chars =
            "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        id = "PAT-";

        for (
            let i = 0;
            i < 6;
            i++
        ) {

            id +=
                chars[
                    Math.floor(
                        Math.random() *
                        chars.length
                    )
                ];
        }


        try {

            sessionStorage.setItem(
                "resq_temporary_patient_id",
                id
            );

        } catch (error) {

            console.warn(
                "Unable to save temporary ID.",
                error
            );
        }
    }

    return id;
}


/* =========================================================
   LOCATION
   ========================================================= */

function setLocation(
    latitude,
    longitude,
    source
) {

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
            source || "manual"
    };


    const latitudeInput =
        document.getElementById(
            "latitude"
        );

    const longitudeInput =
        document.getElementById(
            "longitude"
        );

    const status =
        document.getElementById(
            "locationStatus"
        );

    const coordinates =
        document.getElementById(
            "coordinates"
        );


    if (latitudeInput) {

        latitudeInput.value =
            emergencyLocation.latitude;
    }


    if (longitudeInput) {

        longitudeInput.value =
            emergencyLocation.longitude;
    }


    if (status) {

        status.textContent =
            "✓ Emergency location saved.";

        status.style.color =
            "#16733a";
    }


    if (coordinates) {

        coordinates.textContent =
            "Latitude: " +
            emergencyLocation.latitude.toFixed(6) +
            " | Longitude: " +
            emergencyLocation.longitude.toFixed(6);

        coordinates.classList.add(
            "active"
        );
    }


    return emergencyLocation;
}


function getEmergencyLocation() {

    return new Promise(
        function(resolve, reject) {

            if (
                !navigator.geolocation
            ) {

                reject(
                    new Error(
                        "This browser does not support location detection."
                    )
                );

                return;
            }


            navigator.geolocation.getCurrentPosition(

                function(position) {

                    const latitude =
                        Number(
                            position.coords.latitude
                        );

                    const longitude =
                        Number(
                            position.coords.longitude
                        );


                    if (
                        !validCoords(
                            latitude,
                            longitude
                        )
                    ) {

                        reject(
                            new Error(
                                "The browser returned an invalid location."
                            )
                        );

                        return;
                    }


                    emergencyLocation = {

                        latitude:
                            latitude,

                        longitude:
                            longitude,

                        accuracy:
                            Number(
                                position.coords.accuracy
                            ) || null,

                        source:
                            "browser"
                    };


                    setLocation(
                        latitude,
                        longitude,
                        "browser"
                    );


                    resolve(
                        emergencyLocation
                    );
                },


                function(error) {

                    if (
                        error.code === 1
                    ) {

                        reject(
                            new Error(
                                "Location permission was denied. Allow location access and try again."
                            )
                        );

                        return;
                    }


                    if (
                        error.code === 2
                    ) {

                        reject(
                            new Error(
                                "Your device could not determine its location."
                            )
                        );

                        return;
                    }


                    if (
                        error.code === 3
                    ) {

                        reject(
                            new Error(
                                "Location detection timed out. Please try again."
                            )
                        );

                        return;
                    }


                    reject(
                        new Error(
                            "Unable to detect your location."
                        )
                    );
                },


                {
                    enableHighAccuracy:
                        true,

                    timeout:
                        15000,

                    maximumAge:
                        30000
                }
            );
        }
    );
}


/* =========================================================
   AUTH
   ========================================================= */

async function currentUser() {

    const supabase =
        db();

    if (!supabase) {
        return null;
    }


    try {

        const result =
            await supabase.auth.getUser();


        return (
            result.data &&
            result.data.user
        )
            ? result.data.user
            : null;

    } catch (error) {

        console.warn(
            "Unable to read current user.",
            error
        );

        return null;
    }
}


async function getOrCreateEmergencyIdentity() {

    const supabase =
        db();


    if (!supabase) {

        throw new Error(
            "Supabase is not configured."
        );
    }


    const existing =
        await currentUser();


    if (existing) {

        return {

            user:
                existing,

            anonymous:
                Boolean(
                    existing.is_anonymous
                )
        };
    }


    const result =
        await supabase.auth.signInAnonymously();


    if (
        result.error ||
        !result.data ||
        !result.data.user
    ) {

        console.error(
            "Anonymous Auth error:",
            result.error
        );

        throw new Error(
            "Emergency access could not start. Enable Anonymous Sign-Ins in Supabase Authentication."
        );
    }


    return {

        user:
            result.data.user,

        anonymous:
            true
    };
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


    const identity =
        await getOrCreateEmergencyIdentity();


    const patientId =
        data.temporaryPatientId ||
        temporaryPatientId();


    const result =
        await supabase.rpc(
            "create_guest_emergency",
            {

                p_emergency_type:
                    data.emergencyType,

                p_priority:
                    data.priority ||
                    "high",

                p_latitude:
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

                p_description:
                    data.description ||
                    null
            }
        );


    if (result.error) {

        console.error(
            "Emergency RPC error:",
            result.error
        );

        throw new Error(
            result.error.message ||
            "Emergency request could not be created."
        );
    }


    const rpc =
        result.data || {};


    if (!rpc.emergency_id) {

        throw new Error(
            "Emergency was created but no ID was returned."
        );
    }


    try {

        localStorage.setItem(
            "resq_active_emergency_id",
            rpc.emergency_id
        );

        localStorage.setItem(
            "resq_temporary_patient_id",
            patientId
        );

    } catch (error) {

        console.warn(
            "Unable to save emergency locally.",
            error
        );
    }


    let emergency =
        null;


    const lookup =
        await supabase
            .from("emergencies")
            .select("*")
            .eq(
                "id",
                rpc.emergency_id
            )
            .maybeSingle();


    if (!lookup.error) {

        emergency =
            lookup.data;
    }


    return {

        success:
            true,

        emergencyId:
            rpc.emergency_id,

        emergency:
            emergency,

        temporaryPatientId:
            patientId,

        anonymous:
            identity.anonymous,

        hospitalId:
            rpc.hospital_id ||
            null
    };
}


/* =========================================================
   EMERGENCY LOOKUP
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


    const result =
        await supabase
            .from("emergencies")
            .select("*")
            .eq(
                "id",
                id
            )
            .maybeSingle();


    return result.error
        ? null
        : result.data;
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


    const result =
        await supabase
            .from("emergencies")
            .update({

                status:
                    status,

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                id
            )
            .select(
                "id,status"
            )
            .maybeSingle();


    if (result.error) {

        console.error(
            "Emergency status update failed:",
            result.error
        );

        return false;
    }


    try {

        await supabase
            .from("emergency_events")
            .insert({

                emergency_id:
                    id,

                event_type:
                    status,

                description:
                    description ||
                    "Emergency status changed to " +
                    status +
                    "."
            });

    } catch (error) {

        console.warn(
            "Emergency event logging failed.",
            error
        );
    }


    return true;
}


/* =========================================================
   ACTIVE EMERGENCY
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


    const result =
        await supabase
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
   SUCCESS BOX
   ========================================================= */

function showSuccess(
    emergency,
    patientId
) {

    const box =
        document.getElementById(
            "successBox"
        );


    if (!box) {
        return;
    }


    const status =
        emergency &&
        emergency.status
            ? emergency.status
            : "DISPATCHING";


    box.innerHTML =

        "<strong>🚑 Help request sent</strong>" +

        "<div>" +
        "Temporary Patient ID: " +
        "<code>" +
        escapeHtml(patientId) +
        "</code>" +
        "</div>" +

        "<div>" +
        "Status: " +
        "<strong>" +
        escapeHtml(status) +
        "</strong>" +
        "</div>" +

        "<div style=\"margin-top:5px;font-size:11px\">" +
        "Nearby available ambulances can accept this request. " +
        "The same patient ID will be shown to the hospital." +
        "</div>";


    box.classList.add(
        "show"
    );
}


/* =========================================================
   REALTIME STATUS
   ========================================================= */

function watchEmergency(
    id
) {

    const supabase =
        db();


    if (
        !supabase ||
        !id
    ) {

        return;
    }


    if (
        emergencyRealtimeChannel
    ) {

        supabase.removeChannel(
            emergencyRealtimeChannel
        );
    }


    emergencyRealtimeChannel =
        supabase
            .channel(
                "emergency-request-" +
                id
            )
            .on(

                "postgres_changes",

                {

                    event:
                        "UPDATE",

                    schema:
                        "public",

                    table:
                        "emergencies",

                    filter:
                        "id=eq." +
                        id
                },

                function(payload) {

                    const emergency =
                        payload.new || {};


                    showSuccess(
                        emergency,
                        temporaryPatientId()
                    );
                }
            )
            .subscribe();
}


/* =========================================================
   PERSON TYPE UI
   ========================================================= */

function setupPersonType() {

    const panel =
        document.getElementById(
            "knownPatientPanel"
        );


    document
        .querySelectorAll(
            'input[name="personType"]'
        )
        .forEach(
            function(input) {

                input.addEventListener(
                    "change",
                    function() {

                        if (panel) {

                            panel.style.display =
                                personType() === "me"
                                    ? "block"
                                    : "none";
                        }
                    }
                );
            }
        );


    if (panel) {

        panel.style.display =
            personType() === "me"
                ? "block"
                : "none";
    }
}


/* =========================================================
   LOCATION BUTTONS
   ========================================================= */

function setupLocation() {

    const detect =
        document.getElementById(
            "detectLocation"
        );

    const manualOpen =
        document.getElementById(
            "showManualLocation"
        );

    const panel =
        document.getElementById(
            "manualLocationPanel"
        );

    const save =
        document.getElementById(
            "saveManualLocation"
        );

    const cancel =
        document.getElementById(
            "cancelManualLocation"
        );


    if (detect) {

        detect.addEventListener(
            "click",
            async function() {

                const old =
                    detect.textContent;

                detect.disabled =
                    true;

                detect.textContent =
                    "Detecting location...";


                try {

                    await getEmergencyLocation();

                    message(
                        "Location detected successfully.",
                        "success"
                    );

                } catch (error) {

                    message(
                        error.message,
                        "error"
                    );

                } finally {

                    detect.disabled =
                        false;

                    detect.textContent =
                        old;
                }
            }
        );
    }


    if (
        manualOpen &&
        panel
    ) {

        manualOpen.addEventListener(
            "click",
            function() {

                panel.classList.add(
                    "active"
                );
            }
        );
    }


    if (
        cancel &&
        panel
    ) {

        cancel.addEventListener(
            "click",
            function() {

                panel.classList.remove(
                    "active"
                );
            }
        );
    }


    if (save) {

        save.addEventListener(
            "click",
            async function() {

                const address =
                    value("manualAddress");

                const city =
                    value("manualCity");

                const state =
                    value("manualState");

                const pin =
                    value("manualPincode");


                if (
                    !address &&
                    !city
                ) {

                    message(
                        "Enter an address or city first.",
                        "error"
                    );

                    return;
                }


                if (
                    pin &&
                    !/^\d{6}$/.test(pin)
                ) {

                    message(
                        "Enter a valid 6-digit pincode.",
                        "error"
                    );

                    return;
                }


                const query =
                    [
                        address,
                        city,
                        state,
                        pin
                    ]
                        .filter(Boolean)
                        .join(", ");


                save.disabled =
                    true;

                save.textContent =
                    "Finding...";


                try {

                    const response =
                        await fetch(

                            "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=" +
                            encodeURIComponent(
                                query
                            ),

                            {
                                headers: {
                                    Accept:
                                        "application/json"
                                }
                            }
                        );


                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            "Unable to find that location."
                        );
                    }


                    const results =
                        await response.json();


                    if (
                        !results.length
                    ) {

                        throw new Error(
                            "That address could not be located."
                        );
                    }


                    setLocation(

                        Number(
                            results[0].lat
                        ),

                        Number(
                            results[0].lon
                        ),

                        "manual"
                    );


                    if (panel) {

                        panel.classList.remove(
                            "active"
                        );
                    }


                    message(
                        "Manual emergency location saved.",
                        "success"
                    );

                } catch (error) {

                    message(
                        error.message,
                        "error"
                    );

                } finally {

                    save.disabled =
                        false;

                    save.textContent =
                        "Save manual location";
                }
            }
        );
    }
}


/* =========================================================
   FORM SUBMISSION
   ========================================================= */

async function submitEmergency(
    event
) {

    event.preventDefault();

    clearMessage();


    const button =
        document.getElementById(
            "requestButton"
        );


    if (button) {

        button.disabled =
            true;

        button.dataset.oldText =
            button.textContent;

        button.textContent =
            "Connecting to emergency network...";
    }


    try {

        const emergencyType =
            value("emergencyType");


        if (!emergencyType) {

            throw new Error(
                "Please select what is happening."
            );
        }


        if (
            !validCoords(
                emergencyLocation.latitude,
                emergencyLocation.longitude
            )
        ) {

            await getEmergencyLocation();
        }


        const patientId =
            temporaryPatientId();


        const result =
            await createEmergency({

                personType:
                    personType(),

                temporaryPatientId:
                    patientId,

                emergencyType:
                    emergencyType,

                condition:
                    value(
                        "patientCondition"
                    ),

                description:
                    value(
                        "description"
                    ),

                priority:
                    radio("priority") ||
                    "high",

                location:
                    emergencyLocation
            });


        showSuccess(
            result.emergency,
            patientId
        );


        message(
            "Emergency request sent successfully.",
            "success"
        );


        watchEmergency(
            result.emergencyId
        );


        if (button) {

            button.textContent =
                "✓ EMERGENCY REQUEST ACTIVE";
        }

    } catch (error) {

        console.error(
            "Emergency submission failed:",
            error
        );


        message(

            error.message ||
            "Emergency request could not be created.",

            "error"
        );


        if (button) {

            button.disabled =
                false;

            button.textContent =
                button.dataset.oldText ||
                "🚑 REQUEST EMERGENCY ASSISTANCE";
        }
    }
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initEmergencyPage() {

    const id =
        document.getElementById(
            "temporaryPatientId"
        );


    if (id) {

        id.textContent =
            temporaryPatientId();
    }


    setupPersonType();

    setupLocation();


    const form =
        document.getElementById(
            "emergencyForm"
        );


    if (
        form &&
        form.dataset.resqBound !== "true"
    ) {

        form.dataset.resqBound =
            "true";

        form.addEventListener(
            "submit",
            submitEmergency
        );
    }


    let stored =
        null;


    try {

        stored =
            localStorage.getItem(
                "resq_active_emergency_id"
            );

    } catch (error) {

        console.warn(
            "Local storage unavailable.",
            error
        );
    }


    if (stored) {

        getEmergencyById(
            stored
        ).then(
            function(emergency) {

                if (
                    emergency &&
                    EMERGENCY_CONFIG
                        .activeStatuses
                        .includes(
                            emergency.status
                        )
                ) {

                    showSuccess(
                        emergency,
                        temporaryPatientId()
                    );

                    watchEmergency(
                        emergency.id
                    );
                }
            }
        );
    }
}


/* =========================================================
   PUBLIC API
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

    calculateDistance:
        function(
            lat1,
            lng1,
            lat2,
            lng2
        ) {

            if (
                !validCoords(
                    lat1,
                    lng1
                ) ||
                !validCoords(
                    lat2,
                    lng2
                )
            ) {

                return Infinity;
            }


            const earthRadius =
                6371;


            const dLat =
                (
                    Number(lat2) -
                    Number(lat1)
                ) *
                Math.PI /
                180;


            const dLng =
                (
                    Number(lng2) -
                    Number(lng1)
                ) *
                Math.PI /
                180;


            const a =
                Math.sin(
                    dLat / 2
                ) ** 2 +

                Math.cos(
                    Number(lat1) *
                    Math.PI /
                    180
                ) *

                Math.cos(
                    Number(lat2) *
                    Math.PI /
                    180
                ) *

                Math.sin(
                    dLng / 2
                ) ** 2;


            return (
                earthRadius *
                2 *
                Math.atan2(
                    Math.sqrt(a),
                    Math.sqrt(1 - a)
                )
            );
        }
};


document.addEventListener(
    "DOMContentLoaded",
    initEmergencyPage
);