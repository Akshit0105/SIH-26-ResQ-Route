/* =========================================================
   ResQ-Route
   Supabase Client Configuration
   ========================================================= */


/* =========================================================
   SUPABASE PROJECT CONFIGURATION
   ========================================================= */

const SUPABASE_URL =
    "https://teunajhcuadiacbzohsh.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_watS5zhRnq_dE6v9ZUTm2w_7y_fbv3c";


/* =========================================================
   CREATE SUPABASE CLIENT
   ========================================================= */

let supabaseClient = null;

try {

    if (
        typeof window.supabase !== "undefined" &&
        typeof window.supabase.createClient === "function"
    ) {

        supabaseClient =
            window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLISHABLE_KEY,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true,
                        flowType: "pkce"
                    }
                }
            );

        console.log(
            "ResQ-Route: Supabase client initialized successfully."
        );

    } else {

        console.error(
            "ResQ-Route: Supabase library not found."
        );

        console.error(
            "Load Supabase before js/supabase.js:"
        );

        console.error(
            "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
        );
    }

} catch (error) {

    console.error(
        "ResQ-Route: Supabase initialization error:",
        error
    );
}


/* =========================================================
   CHECK SUPABASE CONNECTION
   ========================================================= */

async function checkSupabaseConnection() {

    if (!supabaseClient) {

        console.error(
            "Supabase client is not initialized."
        );

        return false;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();


        if (error) {

            console.error(
                "Supabase connection error:",
                error.message
            );

            return false;
        }


        console.log(
            "Supabase connection successful."
        );


        return true;

    } catch (error) {

        console.error(
            "Supabase connection failed:",
            error
        );

        return false;
    }
}


/* =========================================================
   GET CURRENT SESSION
   ========================================================= */

async function getCurrentSession() {

    if (!supabaseClient) {
        return null;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getSession();


        if (error) {

            console.error(
                "Unable to get session:",
                error.message
            );

            return null;
        }


        return data?.session || null;

    } catch (error) {

        console.error(
            "Session error:",
            error
        );

        return null;
    }
}


/* =========================================================
   GET CURRENT USER
   ========================================================= */

async function getCurrentUser() {

    if (!supabaseClient) {
        return null;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient.auth.getUser();


        if (error) {

            console.error(
                "Unable to get current user:",
                error.message
            );

            return null;
        }


        return data?.user || null;

    } catch (error) {

        console.error(
            "User retrieval error:",
            error
        );

        return null;
    }
}


/* =========================================================
   GET CURRENT USER PROFILE
   ========================================================= */

async function getCurrentProfile() {

    if (!supabaseClient) {
        return null;
    }


    const user =
        await getCurrentUser();


    if (!user) {
        return null;
    }


    try {

        const {
            data,
            error
        } = await supabaseClient
            .from("profiles")
            .select("*")
            .eq(
                "id",
                user.id
            )
            .maybeSingle();


        if (error) {

            console.error(
                "Profile retrieval error:",
                error
            );

            return null;
        }


        return data || null;

    } catch (error) {

        console.error(
            "Profile retrieval failed:",
            error
        );

        return null;
    }
}


/* =========================================================
   GET USER ROLE
   ========================================================= */

async function getCurrentUserRole() {

    const profile =
        await getCurrentProfile();


    if (!profile) {
        return null;
    }


    return profile.role || null;
}


/* =========================================================
   CLEAR LOCAL AUTH DATA
   ========================================================= */

function clearLocalAuthData() {

    try {

        const localKeys = [];


        for (
            let i = 0;
            i < localStorage.length;
            i++
        ) {

            const key =
                localStorage.key(i);


            if (!key) {
                continue;
            }


            /*
             * Supabase auth storage
             */

            if (
                key.startsWith("sb-")
            ) {

                localKeys.push(
                    key
                );

                continue;
            }


            /*
             * ResQ-Route application
             * authentication/session data.
             */

            if (
                key.startsWith(
                    "resq-route-auth"
                )
            ) {

                localKeys.push(
                    key
                );
            }

        }


        localKeys.forEach(
            key => {

                try {

                    localStorage.removeItem(
                        key
                    );

                } catch (error) {

                    console.warn(
                        "Could not remove local key:",
                        key
                    );

                }

            }
        );


        /*
         * Remove only ResQ authentication
         * data from sessionStorage.
         */

        const sessionKeys = [];


        for (
            let i = 0;
            i < sessionStorage.length;
            i++
        ) {

            const key =
                sessionStorage.key(i);


            if (
                key &&
                key.startsWith(
                    "resq-route-auth"
                )
            ) {

                sessionKeys.push(
                    key
                );
            }

        }


        sessionKeys.forEach(
            key => {

                try {

                    sessionStorage.removeItem(
                        key
                    );

                } catch {

                    // Ignore cleanup errors.

                }

            }
        );


    } catch (error) {

        console.warn(
            "Unable to completely clear local auth data:",
            error
        );
    }
}


/* =========================================================
   CLEAR ACTIVE EMERGENCY
   ========================================================= */

function clearActiveEmergencyData() {

    try {

        localStorage.removeItem(
            "resq_active_emergency_id"
        );

    } catch (error) {

        console.warn(
            "Unable to clear active emergency:",
            error
        );
    }
}


/* =========================================================
   SIGN OUT USER
   ========================================================= */

async function signOutUser() {

    if (!supabaseClient) {

        clearLocalAuthData();

        clearActiveEmergencyData();

        return false;
    }


    try {

        /*
         * Local scope is enough for this browser.
         * It immediately removes the local session.
         */

        const {
            error
        } = await supabaseClient.auth.signOut({

            scope:
                "local"

        });


        if (error) {

            console.error(
                "Sign out error:",
                error.message
            );

        }


        clearLocalAuthData();


        /*
         * Do NOT delete the active emergency
         * from the database.
         *
         * Only remove the browser reference.
         */

        clearActiveEmergencyData();


        return !error;

    } catch (error) {

        console.error(
            "Sign out failed:",
            error
        );


        clearLocalAuthData();

        clearActiveEmergencyData();


        return false;
    }
}


/* =========================================================
   GET CURRENT PAGE
   ========================================================= */

function getCurrentPage() {

    return window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();
}


/* =========================================================
   AUTHENTICATION PAGES
   ========================================================= */

const AUTH_PAGES = [

    "",

    "index.html",

    "signin.html",

    "signup.html",

    "terms.html",

    "forgot-password.html"

];


/* =========================================================
   PROTECTED DASHBOARDS
   ========================================================= */

const PROTECTED_PAGES = [

    "family.html",

    "ambulance.html",

    "hospital.html"

];


/* =========================================================
   REDIRECT TO SIGN IN
   ========================================================= */

function redirectToSignIn() {

    const currentPage =
        getCurrentPage();


    if (
        currentPage ===
        "signin.html"
    ) {

        return;
    }


    /*
     * replace() prevents the protected
     * page from becoming the immediate
     * navigation target.
     */

    window.location.replace(
        "signin.html"
    );
}


/* =========================================================
   REDIRECT BY ROLE
   ========================================================= */

function getDashboardForRole(
    role
) {

    switch (
        String(role || "")
            .toLowerCase()
            .trim()
    ) {

        case "family":
        case "citizen":

            return "family.html";


        case "driver":
        case "ambulance":

            return "ambulance.html";


        case "hospital":
        case "hospital_staff":

            return "hospital.html";


        default:

            return null;
    }
}


/* =========================================================
   PROTECT DASHBOARD
   ========================================================= */

async function protectDashboard(
    allowedRoles = []
) {

    if (!supabaseClient) {

        console.error(
            "Dashboard protection failed: Supabase unavailable."
        );

        redirectToSignIn();

        return false;
    }


    try {

        const session =
            await getCurrentSession();


        if (!session) {

            redirectToSignIn();

            return false;
        }


        /*
         * If no role restriction was supplied,
         * authentication alone is enough.
         */

        if (
            !Array.isArray(allowedRoles) ||
            allowedRoles.length === 0
        ) {

            return true;
        }


        const profile =
            await getCurrentProfile();


        if (!profile) {

            console.error(
                "Authenticated user has no profile."
            );

            await signOutUser();

            redirectToSignIn();

            return false;
        }


        const role =
            String(
                profile.role || ""
            )
            .toLowerCase()
            .trim();


        const normalizedAllowedRoles =
            allowedRoles.map(
                value =>
                    String(value)
                        .toLowerCase()
                        .trim()
            );


        if (
            !normalizedAllowedRoles.includes(
                role
            )
        ) {

            console.warn(
                "User attempted to access an unauthorized dashboard."
            );


            const correctDashboard =
                getDashboardForRole(
                    role
                );


            if (
                correctDashboard &&
                getCurrentPage() !==
                    correctDashboard
            ) {

                window.location.replace(
                    correctDashboard
                );

            } else {

                redirectToSignIn();

            }


            return false;
        }


        return true;

    } catch (error) {

        console.error(
            "Dashboard authentication check failed:",
            error
        );

        redirectToSignIn();

        return false;
    }
}


/* =========================================================
   PREVENT DASHBOARD CACHING
   ========================================================= */

function preventDashboardCaching() {

    try {

        /*
         * Prevent normal browser cache.
         * Authentication checks are still required.
         */

        const metaCache =
            document.createElement(
                "meta"
            );


        metaCache.httpEquiv =
            "Cache-Control";

        metaCache.content =
            "no-store, no-cache, must-revalidate, max-age=0";


        document.head.appendChild(
            metaCache
        );


        const metaPragma =
            document.createElement(
                "meta"
            );


        metaPragma.httpEquiv =
            "Pragma";

        metaPragma.content =
            "no-cache";


        document.head.appendChild(
            metaPragma
        );


        const metaExpires =
            document.createElement(
                "meta"
            );


        metaExpires.httpEquiv =
            "Expires";

        metaExpires.content =
            "0";


        document.head.appendChild(
            metaExpires
        );


        if (
            window.history
        ) {

            window.history.scrollRestoration =
                "manual";
        }

    } catch (error) {

        console.warn(
            "Unable to configure dashboard cache protection:",
            error
        );
    }
}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

function listenToAuthChanges(
    callback
) {

    if (!supabaseClient) {

        console.error(
            "Cannot listen to authentication changes."
        );

        return null;
    }


    const {
        data
    } =
        supabaseClient.auth.onAuthStateChange(

            async (
                event,
                session
            ) => {

                console.log(
                    "ResQ-Route auth state:",
                    event
                );


                /*
                 * Logout protection.
                 */

                if (
                    event ===
                        "SIGNED_OUT" &&
                    !session
                ) {

                    const currentPage =
                        getCurrentPage();


                    if (
                        PROTECTED_PAGES.includes(
                            currentPage
                        )
                    ) {

                        clearLocalAuthData();

                        clearActiveEmergencyData();

                        redirectToSignIn();

                        return;
                    }
                }


                /*
                 * Call application callback.
                 */

                if (
                    typeof callback ===
                    "function"
                ) {

                    try {

                        await callback(
                            event,
                            session
                        );

                    } catch (error) {

                        console.error(
                            "Auth callback error:",
                            error
                        );

                    }
                }

            }

        );


    return data.subscription;
}


/* =========================================================
   WAIT FOR AUTH INITIALIZATION
   ========================================================= */

async function waitForAuthInitialization(
    timeout = 5000
) {

    if (!supabaseClient) {
        return null;
    }


    const start =
        Date.now();


    while (
        Date.now() - start <
        timeout
    ) {

        const session =
            await getCurrentSession();


        /*
         * Session exists.
         */

        if (session) {
            return session;
        }


        /*
         * If no session exists, give
         * Supabase a short amount of time
         * to restore one from storage.
         */

        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    100
                )
        );
    }


    return null;
}


/* =========================================================
   DASHBOARD PAGE PROTECTION
   ========================================================= */

async function protectCurrentDashboard() {

    const currentPage =
        getCurrentPage();


    if (
        !PROTECTED_PAGES.includes(
            currentPage
        )
    ) {

        return true;
    }


    preventDashboardCaching();


    /*
     * Match dashboard to allowed role.
     */

    let allowedRoles =
        [];


    switch (
        currentPage
    ) {

        case "family.html":

            allowedRoles = [
                "family"
            ];

            break;


        case "ambulance.html":

            allowedRoles = [
                "driver"
            ];

            break;


        case "hospital.html":

            allowedRoles = [
                "hospital"
            ];

            break;

    }


    return await protectDashboard(
        allowedRoles
    );
}


/* =========================================================
   HANDLE BACK/FORWARD CACHE
   ========================================================= */

function setupPageRestoreProtection() {

    window.addEventListener(
        "pageshow",
        async function(event) {

            const currentPage =
                getCurrentPage();


            if (
                !PROTECTED_PAGES.includes(
                    currentPage
                )
            ) {

                return;
            }


            /*
             * pageshow with persisted=true
             * means browser restored page from
             * back-forward cache.
             */

            if (
                event.persisted
            ) {

                const valid =
                    await protectCurrentDashboard();


                if (!valid) {
                    return;
                }
            }

        }
    );
}


/* =========================================================
   AUTH STATE INITIALIZATION
   ========================================================= */

function setupAuthStateListener() {

    listenToAuthChanges(
        async (
            event,
            session
        ) => {

            const currentPage =
                getCurrentPage();


            if (
                event ===
                    "SIGNED_OUT" &&
                !session
            ) {

                if (
                    PROTECTED_PAGES.includes(
                        currentPage
                    )
                ) {

                    redirectToSignIn();
                }
            }

        }
    );
}


/* =========================================================
   GLOBAL RESQ-ROUTE OBJECT
   ========================================================= */

window.resqRoute = {

    supabase:
        supabaseClient,

    checkConnection:
        checkSupabaseConnection,

    getSession:
        getCurrentSession,

    getUser:
        getCurrentUser,

    getProfile:
        getCurrentProfile,

    getRole:
        getCurrentUserRole,

    signOut:
        signOutUser,

    protectDashboard:
        protectDashboard,

    protectCurrentDashboard:
        protectCurrentDashboard,

    redirectToSignIn:
        redirectToSignIn,

    getDashboardForRole:
        getDashboardForRole,

    preventDashboardCaching:
        preventDashboardCaching,

    clearLocalAuthData:
        clearLocalAuthData,

    clearActiveEmergency:
        clearActiveEmergencyData,

    waitForAuth:
        waitForAuthInitialization,

    onAuthStateChange:
        listenToAuthChanges

};


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        const currentPage =
            getCurrentPage();


        /*
         * Dashboard protection.
         */

        if (
            PROTECTED_PAGES.includes(
                currentPage
            )
        ) {

            await protectCurrentDashboard();

        }


        /*
         * Listen for login/logout changes.
         */

        setupAuthStateListener();

    }
);


/*
 * Protect pages restored through browser
 * Back/Forward navigation.
 */

setupPageRestoreProtection();


/* =========================================================
   MODULE LOADED
   ========================================================= */

console.log(
    "ResQ-Route Supabase module loaded."
);