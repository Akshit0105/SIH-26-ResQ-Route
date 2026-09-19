
/* =========================================================
   ResQ-Route
   Realtime Dashboard Synchronization
   =========================================================

   FAMILY
      ↕
   SUPABASE REALTIME
      ↕
   AMBULANCE ←→ HOSPITAL

   Handles:
   1. Emergency status
   2. Ambulance location
   3. Patient vitals
   4. Emergency timeline
   5. Ambulance assignment
   6. Hospital assignment
   7. Notifications
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const REALTIME_CONFIG = {

    emergencyStorageKey:
        "resq_active_emergency_id",

    locationUpdateInterval:
        5000,

    reconnectDelay:
        3000,

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

function getRealtimeSupabase() {

    /*
     * Use the shared ResQ-Route client when available.
     * Fall back to the global client used by the dashboards.
     */

    const supabase =
        window.resqRoute?.supabase ||
        window.supabaseClient ||
        window.supabase;

    if (!supabase) {

        console.error(
            "Supabase client is not available."
        );

        return null;
    }

    return supabase;
}


/* =========================================================
   REALTIME STATE
   ========================================================= */

const realtimeState = {

    emergencyChannel:
        null,

    notificationChannel:
        null,

    connected:
        false,

    emergencyId:
        null,

    reconnectTimer:
        null

};


/* =========================================================
   CALLBACKS
   ========================================================= */

const realtimeCallbacks = {

    emergency: [],

    ambulance: [],

    vitals: [],

    event: [],

    notification: [],

    connection: []

};


/* =========================================================
   CALLBACK REGISTRATION
   ========================================================= */

function registerRealtimeCallback(
    type,
    callback
) {

    if (
        !realtimeCallbacks[type] ||
        typeof callback !== "function"
    ) {

        return;
    }

    realtimeCallbacks[type].push(
        callback
    );
}


function triggerRealtimeCallbacks(
    type,
    payload
) {

    if (!realtimeCallbacks[type]) {
        return;
    }

    realtimeCallbacks[type].forEach(
        callback => {

            try {

                callback(payload);

            } catch (error) {

                console.error(
                    `Realtime ${type} callback error:`,
                    error
                );

            }

        }
    );
}


/* =========================================================
   EMERGENCY ID
   ========================================================= */

function getActiveEmergencyId() {

    try {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const urlEmergencyId =
            params.get("emergency");

        if (urlEmergencyId) {

            localStorage.setItem(
                REALTIME_CONFIG.emergencyStorageKey,
                urlEmergencyId
            );

            return urlEmergencyId;
        }

        return localStorage.getItem(
            REALTIME_CONFIG.emergencyStorageKey
        );

    } catch (error) {

        console.error(
            "Unable to get emergency ID:",
            error
        );

        return null;
    }
}


function setActiveEmergencyId(
    emergencyId
) {

    if (!emergencyId) {
        return;
    }

    try {

        localStorage.setItem(
            REALTIME_CONFIG.emergencyStorageKey,
            emergencyId
        );

        realtimeState.emergencyId =
            emergencyId;

    } catch (error) {

        console.error(
            "Unable to store emergency ID:",
            error
        );
    }
}


function clearActiveEmergencyId() {

    try {

        localStorage.removeItem(
            REALTIME_CONFIG.emergencyStorageKey
        );

    } catch (error) {

        console.error(
            "Unable to clear emergency ID:",
            error
        );
    }

    realtimeState.emergencyId =
        null;
}


/* =========================================================
   CONNECTION STATUS
   ========================================================= */

function updateRealtimeConnection(
    connected
) {

    realtimeState.connected =
        connected;

    triggerRealtimeCallbacks(
        "connection",
        connected
    );

    const indicators =
        document.querySelectorAll(
            "#realtimeStatus, [data-realtime-status]"
        );

    indicators.forEach(
        indicator => {

            indicator.textContent =
                connected
                    ? "Live"
                    : "Offline";

            indicator.classList.toggle(
                "badge-success",
                connected
            );

            indicator.classList.toggle(
                "badge-danger",
                !connected
            );

        }
    );
}


/* =========================================================
   UPDATE ELEMENT
   ========================================================= */

function updateElementsById(
    ids,
    value
) {

    ids.forEach(
        id => {

            const element =
                document.getElementById(id);

            if (!element) {
                return;
            }

            if (
                element.tagName === "INPUT" ||
                element.tagName === "TEXTAREA" ||
                element.tagName === "SELECT"
            ) {

                element.value =
                    value;

            } else {

                element.textContent =
                    value;

            }

        }
    );
}


/* =========================================================
   FORMATTERS
   ========================================================= */

function formatEmergencyStatus(
    status
) {

    if (!status) {
        return "-";
    }

    return String(status)
        .replaceAll(
            "_",
            " "
        )
        .toLowerCase()
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );
}


function formatCoordinate(
    coordinate
) {

    if (
        coordinate === null ||
        coordinate === undefined
    ) {

        return "-";
    }

    const value =
        Number(coordinate);

    if (!Number.isFinite(value)) {
        return "-";
    }

    return value.toFixed(6);
}


function formatDateTime(
    timestamp
) {

    if (!timestamp) {
        return "-";
    }

    try {

        return new Date(
            timestamp
        ).toLocaleString(
            "en-IN",
            {
                dateStyle: "medium",
                timeStyle: "short"
            }
        );

    } catch {

        return timestamp;
    }
}


/* =========================================================
   EMERGENCY UPDATE
   ========================================================= */

function handleEmergencyUpdate(
    payload
) {

    const emergency =
        payload?.new ||
        payload?.old;

    if (!emergency) {
        return;
    }

    /*
     * DELETE events have no payload.new.
     * Clear the active emergency only when the deleted
     * row is the emergency currently being tracked.
     */

    if (
        payload?.eventType === "DELETE" &&
        emergency.id === realtimeState.emergencyId
    ) {

        clearActiveEmergencyId();

        updateRealtimeConnection(
            false
        );

        triggerRealtimeCallbacks(
            "emergency",
            payload
        );

        return;
    }

    if (emergency.id) {

        setActiveEmergencyId(
            emergency.id
        );
    }


    /*
     * Status
     */

    updateElementsById(

        [
            "emergencyStatus",
            "status",
            "currentStatus"
        ],

        formatEmergencyStatus(
            emergency.status
        )

    );


    /*
     * Priority
     */

    updateElementsById(

        [
            "emergencyPriority",
            "priority"
        ],

        emergency.priority || "-"

    );


    /*
     * Ambulance
     */

    updateElementsById(

        [
            "ambulanceId",
            "assignedAmbulance"
        ],

        emergency.ambulance_id
            ? emergency.ambulance_id
            : "Searching..."

    );


    /*
     * Hospital
     */

    updateElementsById(

        [
            "hospitalId",
            "assignedHospital"
        ],

        emergency.hospital_id
            ? emergency.hospital_id
            : "Selecting..."

    );


    /*
     * Coordinates
     */

    updateElementsById(

        [
            "emergencyLatitude"
        ],

        formatCoordinate(
            emergency.latitude
        )

    );


    updateElementsById(

        [
            "emergencyLongitude"
        ],

        formatCoordinate(
            emergency.longitude
        )

    );


    /*
     * Update status badges.
     */

    document
        .querySelectorAll(
            "[data-emergency-status]"
        )
        .forEach(
            element => {

                element.textContent =
                    formatEmergencyStatus(
                        emergency.status
                    );

            }
        );


    if (
        typeof window.updateFamilyPatientLocation === "function" &&
        Number.isFinite(Number(emergency.latitude)) &&
        Number.isFinite(Number(emergency.longitude))
    ) {
        window.updateFamilyPatientLocation(
            Number(emergency.latitude),
            Number(emergency.longitude)
        );
    }

    triggerRealtimeCallbacks(
        "emergency",
        payload
    );
}


/* =========================================================
   AMBULANCE LOCATION UPDATE
   ========================================================= */

function handleAmbulanceLocationUpdate(
    payload
) {

    const location =
        payload?.new;

    if (!location) {
        return;
    }

    updateElementsById(

        [
            "ambulanceLatitude"
        ],

        formatCoordinate(
            location.latitude
        )

    );


    updateElementsById(

        [
            "ambulanceLongitude"
        ],

        formatCoordinate(
            location.longitude
        )

    );


    updateElementsById(

        [
            "ambulanceSpeed"
        ],

        location.speed !== null &&
        location.speed !== undefined

            ? `${location.speed} km/h`

            : "-"

    );


    /*
     * Update ETA-related location labels
     * if the dashboard provides them.
     */

    updateElementsById(

        [
            "lastAmbulanceUpdate",
            "locationUpdatedAt"
        ],

        location.timestamp
            ? formatDateTime(
                location.timestamp
            )
            : "Just now"

    );


    /*
     * Update Leaflet/map implementation
     * if the dashboard has registered one.
     */

    if (
        typeof window.resqMapUpdateMarker ===
        "function"
    ) {

        const latitude =
            Number(
                location.latitude
            );

        const longitude =
            Number(
                location.longitude
            );

        if (
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
        ) {

            window.resqMapUpdateMarker(
                latitude,
                longitude
            );

        }

        if (typeof window.updateFamilyAmbulanceLocation === "function") {
            window.updateFamilyAmbulanceLocation(
                latitude,
                longitude
            );
        }
    }


    triggerRealtimeCallbacks(
        "ambulance",
        payload
    );
}


/* =========================================================
   PATIENT VITALS UPDATE
   ========================================================= */

function handleVitalsUpdate(
    payload
) {

    const vitals =
        payload?.new;

    if (!vitals) {
        return;
    }


    /*
     * Heart rate
     */

    updateElementsById(

        [
            "heartRate",
            "heartRateValue"
        ],

        vitals.heart_rate !== null &&
        vitals.heart_rate !== undefined

            ? `${vitals.heart_rate} bpm`

            : "-"

    );


    /*
     * SpO2
     */

    updateElementsById(

        [
            "spo2",
            "spo2Value"
        ],

        vitals.spo2 !== null &&
        vitals.spo2 !== undefined

            ? `${vitals.spo2}%`

            : "-"

    );


    /*
     * Blood pressure
     */

    updateElementsById(

        [
            "bloodPressure",
            "bloodPressureValue"
        ],

        vitals.blood_pressure ||
        "-"

    );


    /*
     * Temperature
     */

    updateElementsById(

        [
            "temperature",
            "temperatureValue"
        ],

        vitals.temperature !== null &&
        vitals.temperature !== undefined

            ? `${vitals.temperature} °C`

            : "-"

    );


    /*
     * ECG
     */

    updateElementsById(

        [
            "ecgStatus",
            "ecg"
        ],

        vitals.ecg_status ||
        "-"

    );


    /*
     * Last recorded time
     */

    updateElementsById(

        [
            "vitalsUpdatedAt",
            "lastVitalsUpdate"
        ],

        vitals.recorded_at
            ? formatDateTime(
                vitals.recorded_at
            )
            : "Just now"

    );


    triggerRealtimeCallbacks(
        "vitals",
        payload
    );
}


/* =========================================================
   EMERGENCY EVENT
   ========================================================= */

function handleEmergencyEvent(
    payload
) {

    const event =
        payload?.new;

    if (!event) {
        return;
    }

    addEventToTimeline(
        event
    );

    triggerRealtimeCallbacks(
        "event",
        payload
    );
}


/* =========================================================
   TIMELINE
   ========================================================= */

function addEventToTimeline(
    event
) {

    const target =
        document.getElementById(
            "emergencyTimeline"
        ) ||
        document.getElementById(
            "timeline"
        );

    if (!target) {
        return;
    }

    const eventId =
        event.id;

    /*
     * Prevent duplicate events before creating
     * the DOM element.
     */

    if (
        eventId &&
        target.querySelector(
            `[data-event-id="${eventId}"]`
        )
    ) {

        return;
    }


    const item =
        document.createElement(
            "div"
        );

    item.className =
        "timeline-item active";


    const dot =
        document.createElement(
            "div"
        );

    dot.className =
        "timeline-dot";


    const content =
        document.createElement(
            "div"
        );


    const title =
        document.createElement(
            "div"
        );

    title.className =
        "timeline-title";

    title.textContent =
        formatEmergencyStatus(
            event.event_type
        );


    const description =
        document.createElement(
            "div"
        );

    description.className =
        "timeline-description";

    description.textContent =
        event.description ||
        "Emergency event received.";


    const time =
        document.createElement(
            "div"
        );

    time.className =
        "timeline-time";

    time.textContent =
        event.created_at
            ? formatDateTime(
                event.created_at
            )
            : "Just now";


    content.appendChild(
        title
    );

    content.appendChild(
        description
    );

    content.appendChild(
        time
    );


    item.appendChild(
        dot
    );

    item.appendChild(
        content
    );


    if (eventId) {

        item.dataset.eventId =
            eventId;

    }


    target.prepend(
        item
    );
}


/* =========================================================
   NOTIFICATION UPDATE
   ========================================================= */

function handleNotificationUpdate(
    payload
) {

    const notification =
        payload?.new;

    if (!notification) {
        return;
    }


    /*
     * Update notification counters.
     */

    document
        .querySelectorAll(
            "[data-notification-count]"
        )
        .forEach(
            element => {

                const current =
                    Number(
                        element.textContent
                    ) || 0;

                element.textContent =
                    current + 1;

            }
        );


    triggerRealtimeCallbacks(
        "notification",
        payload
    );
}


/* =========================================================
   SUBSCRIBE TO EMERGENCY
   ========================================================= */

async function subscribeToEmergency(
    emergencyId
) {

    const supabase =
        getRealtimeSupabase();

    if (
        !supabase ||
        !emergencyId
    ) {

        return null;
    }


    /*
     * Remove previous emergency channel.
     */

    if (
        realtimeState.emergencyChannel
    ) {

        try {

            await supabase.removeChannel(
                realtimeState.emergencyChannel
            );

        } catch (error) {

            console.warn(
                "Previous emergency channel cleanup failed:",
                error
            );

        }

        realtimeState.emergencyChannel =
            null;
    }


    /*
     * Create channel.
     */

    const channel =
        supabase.channel(
            `resq-emergency-${emergencyId}`
        );


    /*
     * Emergency changes.
     */

    channel.on(

        "postgres_changes",

        {

            event: "*",

            schema: "public",

            table: "emergencies",

            filter:
                `id=eq.${emergencyId}`

        },

        handleEmergencyUpdate

    );


    /*
     * Ambulance location.
     */

    channel.on(

        "postgres_changes",

        {

            event: "INSERT",

            schema: "public",

            table: "ambulance_locations",

            filter:
                `emergency_id=eq.${emergencyId}`

        },

        handleAmbulanceLocationUpdate

    );


    /*
     * Patient vitals.
     */

    channel.on(

        "postgres_changes",

        {

            event: "INSERT",

            schema: "public",

            table: "patient_vitals",

            filter:
                `emergency_id=eq.${emergencyId}`

        },

        handleVitalsUpdate

    );


    /*
     * Emergency timeline.
     */

    channel.on(

        "postgres_changes",

        {

            event: "INSERT",

            schema: "public",

            table: "emergency_events",

            filter:
                `emergency_id=eq.${emergencyId}`

        },

        handleEmergencyEvent

    );


    /*
     * Subscribe.
     */

    channel.subscribe(
        status => {

            console.log(
                "Emergency realtime status:",
                status
            );


            if (
                status === "SUBSCRIBED"
            ) {

                updateRealtimeConnection(
                    true
                );

            } else if (

                status ===
                    "CHANNEL_ERROR" ||

                status ===
                    "TIMED_OUT" ||

                status ===
                    "CLOSED"

            ) {

                updateRealtimeConnection(
                    false
                );

                scheduleReconnect();

            }

        }
    );


    realtimeState.emergencyChannel =
        channel;

    realtimeState.emergencyId =
        emergencyId;


    return channel;
}


/* =========================================================
   SUBSCRIBE TO USER NOTIFICATIONS
   ========================================================= */

async function subscribeToNotifications() {

    const supabase =
        getRealtimeSupabase();

    if (!supabase) {
        return null;
    }


    if (
        realtimeState.notificationChannel
    ) {

        try {

            await supabase.removeChannel(
                realtimeState.notificationChannel
            );

        } catch (error) {

            console.warn(
                "Notification channel cleanup failed:",
                error
            );

        }
    }


    let userId =
        null;


    try {

        const {
            data,
            error
        } = await supabase.auth.getUser();


        if (
            error ||
            !data?.user
        ) {

            return null;
        }


        userId =
            data.user.id;

    } catch (error) {

        console.error(
            "Unable to get notification user:",
            error
        );

        return null;
    }


    if (!userId) {
        return null;
    }


    const channel =
        supabase.channel(
            `resq-notifications-${userId}`
        );


    channel.on(

        "postgres_changes",

        {

            event: "INSERT",

            schema: "public",

            table: "notifications",

            filter:
                `user_id=eq.${userId}`

        },

        handleNotificationUpdate

    );


    channel.subscribe(
        status => {

            console.log(
                "Notification realtime status:",
                status
            );

        }
    );


    realtimeState.notificationChannel =
        channel;


    return channel;
}


/* =========================================================
   FETCH INITIAL EMERGENCY
   ========================================================= */

async function fetchInitialEmergency(
    emergencyId
) {

    const supabase =
        getRealtimeSupabase();

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
                "Emergency fetch error:",
                error
            );

            return null;
        }


        if (data) {

            handleEmergencyUpdate({

                new:
                    data

            });

        }


        return data;

    } catch (error) {

        console.error(
            "Initial emergency fetch failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   FETCH LATEST VITALS
   ========================================================= */

async function fetchLatestVitals(
    emergencyId
) {

    const supabase =
        getRealtimeSupabase();

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
            .from("patient_vitals")
            .select("*")
            .eq(
                "emergency_id",
                emergencyId
            )
            .order(
                "recorded_at",
                {
                    ascending:
                        false
                }
            )
            .limit(1)
            .maybeSingle();


        if (error) {

            console.error(
                "Vitals fetch error:",
                error
            );

            return null;
        }


        if (data) {

            handleVitalsUpdate({

                new:
                    data

            });

        }


        return data;

    } catch (error) {

        console.error(
            "Latest vitals fetch failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   FETCH LATEST AMBULANCE LOCATION
   ========================================================= */

async function fetchLatestAmbulanceLocation(
    emergencyId
) {

    const supabase =
        getRealtimeSupabase();

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
            .from("ambulance_locations")
            .select("*")
            .eq(
                "emergency_id",
                emergencyId
            )
            .order(
                "timestamp",
                {
                    ascending:
                        false
                }
            )
            .limit(1)
            .maybeSingle();


        if (error) {

            console.error(
                "Ambulance location fetch error:",
                error
            );

            return null;
        }


        if (data) {

            handleAmbulanceLocationUpdate({

                new:
                    data

            });

        }


        return data;

    } catch (error) {

        console.error(
            "Latest ambulance location fetch failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   FETCH EVENTS
   ========================================================= */

async function fetchEmergencyEvents(
    emergencyId
) {

    const supabase =
        getRealtimeSupabase();

    if (
        !supabase ||
        !emergencyId
    ) {

        return [];
    }


    try {

        const {
            data,
            error
        } = await supabase
            .from("emergency_events")
            .select("*")
            .eq(
                "emergency_id",
                emergencyId
            )
            .order(
                "created_at",
                {
                    ascending:
                        false
                }
            )
            .limit(50);


        if (error) {

            console.error(
                "Emergency events fetch error:",
                error
            );

            return [];
        }


        return data || [];

    } catch (error) {

        console.error(
            "Emergency events fetch failed:",
            error
        );

        return [];
    }
}


/* =========================================================
   LOAD INITIAL REALTIME DATA
   ========================================================= */

async function loadRealtimeData(
    emergencyId
) {

    if (!emergencyId) {
        return;
    }


    /*
     * Emergency
     */

    await fetchInitialEmergency(
        emergencyId
    );


    /*
     * Latest vitals
     */

    await fetchLatestVitals(
        emergencyId
    );


    /*
     * Latest ambulance location
     */

    await fetchLatestAmbulanceLocation(
        emergencyId
    );


    /*
     * Timeline
     */

    const events =
        await fetchEmergencyEvents(
            emergencyId
        );


    /*
     * Database returns newest first.
     * Reverse it so timeline is chronological.
     */

    events
        .slice()
        .reverse()
        .forEach(
            event => {

                addEventToTimeline(
                    event
                );

            }
        );
}


/* =========================================================
   START REALTIME
   ========================================================= */

async function startRealtime(
    emergencyId = null
) {

    emergencyId =
        emergencyId ||
        getActiveEmergencyId();


    if (!emergencyId) {

        console.warn(
            "No active emergency ID found."
        );

        /*
         * Still listen for notifications.
         */

        await subscribeToNotifications();

        return null;
    }


    setActiveEmergencyId(
        emergencyId
    );


    /*
     * Load current data first.
     */

    await loadRealtimeData(
        emergencyId
    );


    /*
     * Subscribe to emergency.
     */

    const channel =
        await subscribeToEmergency(
            emergencyId
        );


    /*
     * Subscribe to notifications.
     */

    await subscribeToNotifications();


    return channel;
}


/* =========================================================
   RECONNECT
   ========================================================= */

function scheduleReconnect() {

    if (
        realtimeState.reconnectTimer
    ) {

        return;
    }


    realtimeState.reconnectTimer =
        setTimeout(
            async () => {

                realtimeState.reconnectTimer =
                    null;


                const emergencyId =
                    getActiveEmergencyId();


                if (!emergencyId) {
                    return;
                }


                try {

                    await startRealtime(
                        emergencyId
                    );

                } catch (error) {

                    console.error(
                        "Realtime reconnect failed:",
                        error
                    );

                }

            },

            REALTIME_CONFIG.reconnectDelay

        );
}


/* =========================================================
   STOP REALTIME
   ========================================================= */

async function stopRealtime() {

    const supabase =
        getRealtimeSupabase();


    if (!supabase) {
        return;
    }


    if (
        realtimeState.emergencyChannel
    ) {

        try {

            await supabase.removeChannel(
                realtimeState.emergencyChannel
            );

        } catch (error) {

            console.warn(
                "Emergency channel removal failed:",
                error
            );

        }
    }


    if (
        realtimeState.notificationChannel
    ) {

        try {

            await supabase.removeChannel(
                realtimeState.notificationChannel
            );

        } catch (error) {

            console.warn(
                "Notification channel removal failed:",
                error
            );

        }
    }


    realtimeState.emergencyChannel =
        null;

    realtimeState.notificationChannel =
        null;

    realtimeState.connected =
        false;


    updateRealtimeConnection(
        false
    );
}


/* =========================================================
   PUBLIC CALLBACK APIs
   ========================================================= */

function onEmergencyUpdate(
    callback
) {

    registerRealtimeCallback(
        "emergency",
        callback
    );
}


function onAmbulanceLocationUpdate(
    callback
) {

    registerRealtimeCallback(
        "ambulance",
        callback
    );
}


function onVitalsUpdate(
    callback
) {

    registerRealtimeCallback(
        "vitals",
        callback
    );
}


function onEmergencyEvent(
    callback
) {

    registerRealtimeCallback(
        "event",
        callback
    );
}


function onNotificationUpdate(
    callback
) {

    registerRealtimeCallback(
        "notification",
        callback
    );
}


function onRealtimeConnection(
    callback
) {

    registerRealtimeCallback(
        "connection",
        callback
    );
}


/* =========================================================
   PAGE INITIALIZATION
   ========================================================= */

document.addEventListener(

    "DOMContentLoaded",

    async function() {

        const page =
            window.location.pathname
                .split("/")
                .pop()
                .toLowerCase();


        /*
         * family.html uses this generic realtime module directly.
         *
         * ambulance.html and hospital.html now have their own
         * page-specific emergency subscriptions:
         *
         * ambulance:
         * available/assigned emergency requests
         *
         * hospital:
         * incoming requests for that hospital
         *
         * Do not start another generic emergency subscription
         * on those pages.
         */

        if (page !== "family.html") {
            return;
        }


        /*
         * Start after authentication has
         * been initialized.
         */

        setTimeout(
            async () => {

                try {

                    const emergencyId =
                        getActiveEmergencyId();


                    await startRealtime(
                        emergencyId
                    );

                } catch (error) {

                    console.error(
                        "Realtime initialization failed:",
                        error
                    );

                }

            },

            300
        );

    }

);


/* =========================================================
   CLEANUP WHEN LEAVING PAGE
   ========================================================= */

window.addEventListener(
    "beforeunload",
    function() {

        /*
         * Supabase automatically cleans up
         * browser channels, so no blocking
         * async operation is performed here.
         */

    }
);


/* =========================================================
   GLOBAL API
   ========================================================= */

window.resqRealtime = {

    start:
        startRealtime,

    stop:
        stopRealtime,

    getEmergencyId:
        getActiveEmergencyId,

    setEmergencyId:
        setActiveEmergencyId,

    clearEmergencyId:
        clearActiveEmergencyId,

    onEmergency:
        onEmergencyUpdate,

    onAmbulanceLocation:
        onAmbulanceLocationUpdate,

    onVitals:
        onVitalsUpdate,

    onEvent:
        onEmergencyEvent,

    onNotification:
        onNotificationUpdate,

    onConnection:
        onRealtimeConnection,

    getState:
        function() {

            return {
                ...realtimeState
            };

        }

};


/* =========================================================
   MODULE LOADED
   ========================================================= */

console.log(
    "ResQ-Route realtime module loaded."
);