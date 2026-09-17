/* =========================================================
   ResQ-Route
   Authentication & User Management
   ========================================================= */


/* =========================================================
   PAGE CONFIGURATION
   ========================================================= */

const AUTH_PAGES = {
    signin: "signin.html",
    signup: "signup.html",
    emergency: "emergency.html",

    family: "family.html",
    driver: "ambulance.html",
    hospital: "hospital.html"
};


const PROTECTED_PAGES = [
    "family.html",
    "ambulance.html",
    "hospital.html"
];


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
   GET SUPABASE
   ========================================================= */

function getSupabase() {

    if (
        window.resqRoute &&
        window.resqRoute.supabase
    ) {

        return window.resqRoute.supabase;

    }

    console.error(
        "ResQ-Route: Supabase client unavailable."
    );

    return null;
}


/* =========================================================
   AUTH MESSAGE
   ========================================================= */

function showAuthMessage(
    message,
    type = "error"
) {

    let element =
        document.getElementById("message") ||
        document.getElementById("authMessage") ||
        document.getElementById("errorMessage") ||
        document.getElementById("successMessage");


    if (!element) {

        element =
            document.createElement("div");

        element.id =
            "resq-auth-notification";

        element.style.position =
            "fixed";

        element.style.top =
            "20px";

        element.style.right =
            "20px";

        element.style.zIndex =
            "99999";

        element.style.padding =
            "14px 18px";

        element.style.borderRadius =
            "10px";

        element.style.maxWidth =
            "400px";

        element.style.fontWeight =
            "600";

        element.style.boxShadow =
            "0 8px 25px rgba(0,0,0,.15)";

        document.body.appendChild(
            element
        );

    }


    element.textContent =
        message;

    element.style.display =
        "block";

    element.style.background =
        type === "success"
            ? "#dcfce7"
            : "#fee2e2";

    element.style.color =
        type === "success"
            ? "#166534"
            : "#991b1b";


    clearTimeout(
        element._resqTimer
    );


    element._resqTimer =
        setTimeout(
            () => {

                element.style.display =
                    "none";

            },
            5000
        );

}


/* =========================================================
   FORM HELPERS
   ========================================================= */

function getValue(...ids) {

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


function getChecked(...ids) {

    for (const id of ids) {

        const element =
            document.getElementById(id);

        if (element) {

            return element.checked;

        }

    }

    return false;
}


/* =========================================================
   ROLE NORMALIZATION
   ========================================================= */

function normalizeRole(role) {

    if (!role) {
        return null;
    }


    role =
        String(role)
            .toLowerCase()
            .trim();


    if (
        role === "family" ||
        role === "citizen" ||
        role === "user"
    ) {

        return "family";

    }


    if (
        role === "driver" ||
        role === "ambulance"
    ) {

        return "driver";

    }


    if (
        role === "hospital" ||
        role === "hospital_staff"
    ) {

        return "hospital";

    }


    return null;
}


/* =========================================================
   ROLE → DASHBOARD
   ========================================================= */

function getDashboardForRole(role) {

    role =
        normalizeRole(role);


    switch (role) {

        case "family":
            return AUTH_PAGES.family;

        case "driver":
            return AUTH_PAGES.driver;

        case "hospital":
            return AUTH_PAGES.hospital;

        default:
            return null;

    }
}


/* =========================================================
   GET USER PROFILE
   ========================================================= */

async function getUserProfile(userId) {

    const supabase =
        getSupabase();


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
            .from("profiles")
            .select(
                "id,name,email,phone,role"
            )
            .eq(
                "id",
                userId
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
   REDIRECT TO SIGN IN
   ========================================================= */

function redirectToSignIn() {

    if (
        getCurrentPage() ===
        AUTH_PAGES.signin
    ) {

        return;

    }


    window.location.replace(
        AUTH_PAGES.signin
    );

}


/* =========================================================
   REDIRECT USER BY ROLE
   ========================================================= */

async function redirectUserByRole(
    userId = null
) {

    const supabase =
        getSupabase();


    if (!supabase) {
        return false;
    }


    try {

        if (!userId) {

            const {
                data,
                error
            } = await supabase.auth.getUser();


            if (
                error ||
                !data?.user
            ) {

                redirectToSignIn();

                return false;

            }


            userId =
                data.user.id;

        }


        const profile =
            await getUserProfile(
                userId
            );


        if (!profile) {

            showAuthMessage(
                "Your account profile could not be found."
            );

            return false;

        }


        const dashboard =
            getDashboardForRole(
                profile.role
            );


        if (!dashboard) {

            showAuthMessage(
                "Your account has an invalid role."
            );

            return false;

        }


        window.location.replace(
            dashboard
        );


        return true;

    } catch (error) {

        console.error(
            "Role redirection error:",
            error
        );

        showAuthMessage(
            "Unable to open your dashboard."
        );

        return false;

    }
}


/* =========================================================
   VALIDATION
   ========================================================= */

function calculateAge(
    dateOfBirth
) {

    if (!dateOfBirth) {
        return null;
    }


    const birth =
        new Date(
            `${dateOfBirth}T00:00:00`
        );


    if (
        Number.isNaN(
            birth.getTime()
        )
    ) {

        return null;

    }


    const today =
        new Date();


    let age =
        today.getFullYear() -
        birth.getFullYear();


    const monthDifference =
        today.getMonth() -
        birth.getMonth();


    if (
        monthDifference < 0 ||
        (
            monthDifference === 0 &&
            today.getDate() < birth.getDate()
        )
    ) {

        age--;

    }


    return age >= 0
        ? age
        : null;
}


function validatePhone(phone) {

    const digits =
        String(phone || "")
            .replace(/\D/g, "");


    return (
        digits.length >= 10 &&
        digits.length <= 15
    );
}


function validateVehicleNumber(
    value
) {

    const normalized =
        String(value || "")
            .toUpperCase()
            .replace(/[\s-]/g, "");


    return /^[A-Z0-9]{5,15}$/
        .test(normalized);
}


function validateDriverDocument(
    type,
    value
) {

    const document =
        String(value || "")
            .trim()
            .toUpperCase();


    switch (type) {

        case "aadhaar":

            return /^\d{12}$/
                .test(document);


        case "pan":

            return /^[A-Z]{5}[0-9]{4}[A-Z]$/
                .test(document);


        case "driving_license":

            return /^[A-Z0-9 -]{5,20}$/
                .test(document);


        default:

            return false;

    }
}


/* =========================================================
   CREATE FAMILY RECORDS
   ========================================================= */

async function createFamilyRecords(
    supabase,
    user,
    formData
) {

    const {
        data: existingPatient,
        error: patientLookupError
    } = await supabase
        .from("patients")
        .select("id")
        .eq(
            "user_id",
            user.id
        )
        .maybeSingle();


    if (patientLookupError) {

        throw new Error(
            "Unable to check patient profile."
        );

    }


    let patient =
        existingPatient;


    if (!patient) {

        const {
            data,
            error
        } = await supabase
            .from("patients")
            .insert({

                user_id:
                    user.id,

                name:
                    formData.name,

                age:
                    formData.age,

                gender:
                    formData.gender || null,

                blood_group:
                    formData.bloodGroup || null,

                allergies:
                    formData.allergies || null,

                medical_conditions:
                    formData.medicalConditions || null,

                consent_given:
                    true,

                consent_timestamp:
                    new Date().toISOString()

            })
            .select("id")
            .single();


        if (error) {

            console.error(
                "Patient creation error:",
                error
            );

            throw new Error(
                "Account created, but patient information could not be saved."
            );

        }


        patient =
            data;

    }


    if (
        formData.emergencyContactName &&
        formData.emergencyContactPhone
    ) {

        const {
            data: existingContact
        } = await supabase
            .from("emergency_contacts")
            .select("id")
            .eq(
                "patient_id",
                patient.id
            )
            .limit(1)
            .maybeSingle();


        if (!existingContact) {

            const {
                error
            } = await supabase
                .from("emergency_contacts")
                .insert({

                    patient_id:
                        patient.id,

                    name:
                        formData.emergencyContactName,

                    relationship:
                        formData.emergencyContactRelationship ||
                        null,

                    phone:
                        formData.emergencyContactPhone,

                    email:
                        formData.emergencyContactEmail ||
                        null

                });


            if (error) {

                throw new Error(
                    "Patient was created, but emergency contact could not be saved."
                );

            }

        }

    }

}


/* =========================================================
   CREATE DRIVER / AMBULANCE
   ========================================================= */

async function createDriverRecords(
    supabase,
    user,
    formData
) {

    const {
        data: existingAmbulance,
        error: lookupError
    } = await supabase
        .from("ambulances")
        .select(
            "id,vehicle_number"
        )
        .eq(
            "driver_id",
            user.id
        )
        .maybeSingle();


    if (lookupError) {

        throw new Error(
            "Unable to check ambulance registration."
        );

    }


    if (existingAmbulance) {

        return existingAmbulance;

    }


    const {
        data,
        error
    } = await supabase
        .from("ambulances")
        .insert({

            vehicle_number:
                String(
                    formData.vehicleNumber
                )
                .toUpperCase()
                .trim(),

            driver_id:
                user.id,

            ambulance_type:
                formData.ambulanceType,

            status:
                "available"

        })
        .select(
            "id,vehicle_number"
        )
        .single();


    if (error) {

        console.error(
            "Ambulance creation error:",
            error
        );


        if (
            error.code === "23505"
        ) {

            throw new Error(
                "This ambulance vehicle number is already registered."
            );

        }


        throw new Error(
            "Driver account was created, but ambulance information could not be saved."
        );

    }


    return data;
}


/* =========================================================
   CREATE HOSPITAL STAFF
   ========================================================= */

async function createHospitalRecords(
    supabase,
    user,
    formData
) {

    const {
        data: existingStaff,
        error: lookupError
    } = await supabase
        .from("hospital_staff")
        .select(
            "hospital_id,designation"
        )
        .eq(
            "user_id",
            user.id
        )
        .maybeSingle();


    if (lookupError) {

        throw new Error(
            "Unable to check hospital staff registration."
        );

    }


    if (existingStaff) {

        return existingStaff;

    }


    if (!formData.hospitalId) {

        throw new Error(
            "Please select your hospital."
        );

    }


    const {
        data,
        error
    } = await supabase
        .from("hospital_staff")
        .insert({

            hospital_id:
                formData.hospitalId,

            user_id:
                user.id,

            designation:
                formData.designation

        })
        .select(
            "hospital_id,designation"
        )
        .single();


    if (error) {

        console.error(
            "Hospital staff creation error:",
            error
        );

        throw new Error(
            "Hospital account was created, but staff information could not be saved."
        );

    }


    return data;
}


/* =========================================================
   LOAD HOSPITALS
   ========================================================= */

async function loadHospitalsForSignup() {

    const select =
        document.getElementById(
            "hospitalId"
        );


    const supabase =
        getSupabase();


    if (
        !select ||
        !supabase
    ) {

        return;

    }


    try {

        const {
            data,
            error
        } = await supabase
            .from("hospitals")
            .select(
                "id,name,address"
            )
            .eq(
                "emergency_available",
                true
            )
            .order(
                "name"
            );


        if (error) {

            console.warn(
                "Could not load hospitals:",
                error.message
            );

            return;

        }


        select.innerHTML =
            '<option value="">Select hospital</option>';


        (data || []).forEach(
            hospital => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    hospital.id;


                option.textContent =
                    hospital.address
                        ? `${hospital.name} - ${hospital.address}`
                        : hospital.name;


                select.appendChild(
                    option
                );

            }
        );

    } catch (error) {

        console.warn(
            "Hospital loading failed:",
            error
        );

    }
}


/* =========================================================
   REGISTER USER
   ========================================================= */

async function registerUser(
    formData
) {

    const supabase =
        getSupabase();


    if (!supabase) {

        showAuthMessage(
            "Supabase is not configured."
        );

        return {
            success: false
        };

    }


    try {

        const name =
            String(
                formData.name || ""
            ).trim();


        const email =
            String(
                formData.email || ""
            )
            .trim()
            .toLowerCase();


        const phone =
            String(
                formData.phone || ""
            ).trim();


        const password =
            formData.password;


        const role =
            normalizeRole(
                formData.role
            );


        /* -----------------------------------------
           BASIC VALIDATION
        ----------------------------------------- */

        if (!name) {

            throw new Error(
                "Name is required."
            );

        }


        if (!email) {

            throw new Error(
                "Email is required."
            );

        }


        if (!validatePhone(phone)) {

            throw new Error(
                "Enter a valid phone number."
            );

        }


        if (
            !password ||
            password.length < 6
        ) {

            throw new Error(
                "Password must contain at least 6 characters."
            );

        }


        if (!role) {

            throw new Error(
                "Please select a valid account role."
            );

        }


        if (!formData.termsConsent) {

            throw new Error(
                "You must accept the Terms & Conditions."
            );

        }


        /* -----------------------------------------
           FAMILY
        ----------------------------------------- */

        if (
            role === "family"
        ) {

            if (
                !formData.medicalConsent
            ) {

                throw new Error(
                    "Medical information consent is required."
                );

            }


            if (
                !formData.emergencyContactConsent
            ) {

                throw new Error(
                    "Emergency contact access consent is required."
                );

            }


            if (
                formData.age !== null &&
                (
                    formData.age < 0 ||
                    formData.age > 130
                )
            ) {

                throw new Error(
                    "Please enter a valid date of birth."
                );

            }

        }


        /* -----------------------------------------
           DRIVER
        ----------------------------------------- */

        if (
            role === "driver"
        ) {

            if (
                !validateVehicleNumber(
                    formData.vehicleNumber
                )
            ) {

                throw new Error(
                    "Enter a valid ambulance vehicle registration number."
                );

            }


            if (!formData.ambulanceType) {

                throw new Error(
                    "Please select an ambulance type."
                );

            }


            if (
                !formData.identityDocumentType
            ) {

                throw new Error(
                    "Please select an identity document."
                );

            }


            if (
                !validateDriverDocument(
                    formData.identityDocumentType,
                    formData.identityDocumentNumber
                )
            ) {

                throw new Error(
                    "Enter a valid identity document number."
                );

            }

            /*
             * OTP verification is NOT trusted from
             * frontend JavaScript.
             *
             * Actual OTP verification must later
             * be handled through a Supabase Edge
             * Function + SMS provider.
             */

        }


        /* -----------------------------------------
           HOSPITAL
        ----------------------------------------- */

        if (
            role === "hospital"
        ) {

            if (!formData.hospitalId) {

                throw new Error(
                    "Please select your hospital."
                );

            }


            if (!formData.designation) {

                throw new Error(
                    "Designation is required."
                );

            }


            if (!formData.hospitalStaffId) {

                throw new Error(
                    "Hospital Staff ID is required."
                );

            }


            if (!formData.hospitalDepartment) {

                throw new Error(
                    "Department is required."
                );

            }


            if (!formData.receptionName) {

                throw new Error(
                    "Reception / ER contact name is required."
                );

            }


            if (
                !validatePhone(
                    formData.receptionPhone
                )
            ) {

                throw new Error(
                    "Enter a valid Reception / ER contact number."
                );

            }

        }


        /* -----------------------------------------
           AUTH METADATA
        ----------------------------------------- */

        const metadata = {

            name:
                name,

            phone:
                phone,

            role:
                role

        };


        if (
            role === "driver"
        ) {

            metadata.vehicle_number =
                String(
                    formData.vehicleNumber
                )
                .toUpperCase()
                .trim();

            metadata.ambulance_type =
                formData.ambulanceType;

            metadata.identity_document_type =
                formData.identityDocumentType;

            metadata.identity_verified =
                false;

        }


        if (
            role === "hospital"
        ) {

            metadata.hospital_id =
                formData.hospitalId;

            metadata.designation =
                formData.designation;

            metadata.hospital_staff_id =
                formData.hospitalStaffId;

            metadata.hospital_department =
                formData.hospitalDepartment;

            metadata.reception_name =
                formData.receptionName;

            metadata.reception_phone =
                formData.receptionPhone;

        }


        /* -----------------------------------------
           CREATE SUPABASE AUTH USER
        ----------------------------------------- */

        const {
            data: authData,
            error: authError
        } = await supabase.auth.signUp({

            email:
                email,

            password:
                password,

            options: {

                data:
                    metadata

            }

        });


        if (authError) {

            throw new Error(
                authError.message
            );

        }


        const user =
            authData?.user;


        if (!user) {

            throw new Error(
                "Account creation failed."
            );

        }


        /*
         * Supabase schema trigger creates
         * the profile automatically.
         */


        /* -----------------------------------------
           EMAIL CONFIRMATION
        ----------------------------------------- */

        if (!authData.session) {

            return {

                success:
                    true,

                user:
                    user,

                session:
                    null,

                needsEmailConfirmation:
                    true,

                message:
                    "Account created. Please confirm your email, then sign in."

            };

        }


        /* -----------------------------------------
           CREATE ROLE RECORDS
        ----------------------------------------- */

        if (
            role === "family"
        ) {

            await createFamilyRecords(
                supabase,
                user,
                formData
            );

        }


        if (
            role === "driver"
        ) {

            await createDriverRecords(
                supabase,
                user,
                formData
            );

        }


        if (
            role === "hospital"
        ) {

            await createHospitalRecords(
                supabase,
                user,
                formData
            );

        }


        return {

            success:
                true,

            user:
                user,

            session:
                authData.session,

            needsEmailConfirmation:
                false

        };


    } catch (error) {

        console.error(
            "Registration error:",
            error
        );


        showAuthMessage(
            error.message ||
            "Registration failed."
        );


        return {

            success:
                false,

            error:
                error

        };

    }
}


/* =========================================================
   COMPLETE ROLE SETUP AFTER LOGIN
   ========================================================= */

async function completeRoleSetup(
    user
) {

    const supabase =
        getSupabase();


    if (
        !supabase ||
        !user
    ) {

        return;

    }


    const metadata =
        user.user_metadata || {};


    const role =
        normalizeRole(
            metadata.role
        );


    /* -----------------------------------------
       DRIVER
    ----------------------------------------- */

    if (
        role === "driver" &&
        metadata.vehicle_number &&
        metadata.ambulance_type
    ) {

        try {

            await createDriverRecords(

                supabase,

                user,

                {

                    vehicleNumber:
                        metadata.vehicle_number,

                    ambulanceType:
                        metadata.ambulance_type

                }

            );

        } catch (error) {

            console.warn(
                "Driver role setup:",
                error.message
            );

        }

    }


    /* -----------------------------------------
       HOSPITAL
    ----------------------------------------- */

    if (
        role === "hospital" &&
        metadata.hospital_id &&
        metadata.designation
    ) {

        try {

            await createHospitalRecords(

                supabase,

                user,

                {

                    hospitalId:
                        metadata.hospital_id,

                    designation:
                        metadata.designation

                }

            );

        } catch (error) {

            console.warn(
                "Hospital role setup:",
                error.message
            );

        }

    }

}


/* =========================================================
   LOGIN
   ========================================================= */

async function loginUser(
    email,
    password
) {

    const supabase =
        getSupabase();


    if (!supabase) {

        showAuthMessage(
            "Supabase is not configured."
        );

        return {
            success: false
        };

    }


    try {

        email =
            String(
                email || ""
            )
            .trim()
            .toLowerCase();


        if (
            !email ||
            !password
        ) {

            throw new Error(
                "Please enter email and password."
            );

        }


        const {
            data,
            error
        } = await supabase.auth
            .signInWithPassword({

                email:
                    email,

                password:
                    password

            });


        if (error) {

            throw new Error(
                error.message
            );

        }


        if (!data?.user) {

            throw new Error(
                "Login failed."
            );

        }


        await completeRoleSetup(
            data.user
        );


        const profile =
            await getUserProfile(
                data.user.id
            );


        if (!profile) {

            throw new Error(
                "Your account profile could not be found."
            );

        }


        const role =
            normalizeRole(
                profile.role
            );


        if (!role) {

            throw new Error(
                "Your account has an invalid role."
            );

        }


        showAuthMessage(
            "Login successful. Opening your dashboard...",
            "success"
        );


        setTimeout(
            () => {

                window.location.replace(
                    getDashboardForRole(
                        role
                    )
                );

            },
            300
        );


        return {

            success:
                true,

            user:
                data.user,

            session:
                data.session,

            profile:
                profile,

            role:
                role

        };


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        showAuthMessage(
            error.message ||
            "Login failed."
        );


        return {

            success:
                false,

            error:
                error

        };

    }

}


/* =========================================================
   PASSWORD RESET
   ========================================================= */

async function resetPassword(
    email
) {

    const supabase =
        getSupabase();


    if (!supabase) {

        showAuthMessage(
            "Supabase is not configured."
        );

        return false;

    }


    try {

        email =
            String(
                email || ""
            )
            .trim()
            .toLowerCase();


        if (!email) {

            throw new Error(
                "Please enter your email address."
            );

        }


        const redirectUrl =
            `${window.location.origin}/signin.html`;


        const {
            error
        } = await supabase.auth
            .resetPasswordForEmail(

                email,

                {
                    redirectTo:
                        redirectUrl
                }

            );


        if (error) {

            throw new Error(
                error.message
            );

        }


        showAuthMessage(
            "Password reset instructions have been sent to your email.",
            "success"
        );


        return true;

    } catch (error) {

        console.error(
            "Password reset error:",
            error
        );


        showAuthMessage(
            error.message ||
            "Unable to send password reset email."
        );


        return false;

    }

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutUser() {

    const supabase =
        getSupabase();


    try {

        if (supabase) {

            await supabase.auth
                .signOut({
                    scope: "local"
                });

        }


        if (
            window.resqRoute &&
            typeof window.resqRoute
                .clearLocalAuthData ===
            "function"
        ) {

            window.resqRoute
                .clearLocalAuthData();

        }


        if (
            window.resqRoute &&
            typeof window.resqRoute
                .clearActiveEmergency ===
            "function"
        ) {

            window.resqRoute
                .clearActiveEmergency();

        }


        /*
         * replace() prevents the dashboard
         * from being the immediate history target.
         */

        window.location.replace(
            AUTH_PAGES.signin
        );


        return true;

    } catch (error) {

        console.error(
            "Logout failed:",
            error
        );


        window.location.replace(
            AUTH_PAGES.signin
        );


        return false;

    }

}


/* =========================================================
   REQUIRE AUTHENTICATION
   ========================================================= */

async function requireAuthentication(
    allowedRoles = []
) {

    const supabase =
        getSupabase();


    if (!supabase) {

        redirectToSignIn();

        return null;

    }


    try {

        const {
            data,
            error
        } = await supabase.auth
            .getSession();


        if (
            error ||
            !data?.session
        ) {

            redirectToSignIn();

            return null;

        }


        const user =
            data.session.user;


        const profile =
            await getUserProfile(
                user.id
            );


        if (!profile) {

            await logoutUser();

            return null;

        }


        const role =
            normalizeRole(
                profile.role
            );


        if (!role) {

            await logoutUser();

            return null;

        }


        if (
            Array.isArray(allowedRoles) &&
            allowedRoles.length > 0
        ) {

            const allowed =
                allowedRoles.map(
                    normalizeRole
                );


            if (
                !allowed.includes(
                    role
                )
            ) {

                const correctDashboard =
                    getDashboardForRole(
                        role
                    );


                if (correctDashboard) {

                    window.location.replace(
                        correctDashboard
                    );

                } else {

                    redirectToSignIn();

                }


                return null;

            }

        }


        return {

            user:
                user,

            profile:
                profile,

            role:
                role

        };

    } catch (error) {

        console.error(
            "Authentication check failed:",
            error
        );


        redirectToSignIn();

        return null;

    }

}


/* =========================================================
   PROTECT CURRENT DASHBOARD
   ========================================================= */

async function protectCurrentDashboard() {

    const currentPage =
        getCurrentPage();


    if (
        !PROTECTED_PAGES.includes(
            currentPage
        )
    ) {

        return null;

    }


    let allowedRoles =
        [];


    switch (currentPage) {

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


    return await requireAuthentication(
        allowedRoles
    );

}


/* =========================================================
   REDIRECT IF ALREADY LOGGED IN
   ========================================================= */

async function redirectIfAuthenticated() {

    const supabase =
        getSupabase();


    if (!supabase) {
        return;
    }


    try {

        const {
            data
        } = await supabase.auth
            .getSession();


        if (
            !data?.session?.user
        ) {

            return;

        }


        await redirectUserByRole(
            data.session.user.id
        );

    } catch (error) {

        console.error(
            "Existing session check failed:",
            error
        );

    }

}


/* =========================================================
   SIGNUP FORM
   ========================================================= */

function setupSignupForm() {

    const form =
        document.getElementById(
            "signupForm"
        );


    if (!form) {
        return;
    }


    if (
        form.dataset.resqBound ===
        "true"
    ) {

        return;

    }


    form.dataset.resqBound =
        "true";


    form.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );


            const originalText =
                submitButton
                    ?.textContent ||
                "Create Account";


            if (submitButton) {

                submitButton.disabled =
                    true;

                submitButton.textContent =
                    "Creating Account...";

            }


            try {

                const selectedRole =
                    document.querySelector(
                        'input[name="role"]:checked'
                    );


                const role =
                    selectedRole
                        ? selectedRole.value
                        : getValue("role");


                const dateOfBirth =
                    getValue(
                        "dateOfBirth"
                    );


                const age =
                    dateOfBirth
                        ? calculateAge(
                            dateOfBirth
                        )
                        : (
                            getValue("age")
                                ? Number(
                                    getValue("age")
                                )
                                : null
                        );


                const formData = {

                    name:
                        getValue(
                            "name",
                            "fullName",
                            "full-name"
                        ),

                    email:
                        getValue(
                            "email"
                        ),

                    phone:
                        getValue(
                            "phone",
                            "mobile"
                        ),

                    password:
                        getValue(
                            "password"
                        ),

                    role:
                        role,

                    dateOfBirth:
                        dateOfBirth,

                    age:
                        age,

                    gender:
                        getValue(
                            "gender"
                        ),

                    bloodGroup:
                        getValue(
                            "bloodGroup",
                            "blood_group"
                        ),

                    allergies:
                        getValue(
                            "allergies"
                        ),

                    medicalConditions:
                        getValue(
                            "medicalConditions",
                            "medical_conditions"
                        ),

                    emergencyContactName:
                        getValue(
                            "emergencyContactName",
                            "contactName"
                        ),

                    emergencyContactRelationship:
                        getValue(
                            "emergencyContactRelationship",
                            "contactRelationship"
                        ),

                    emergencyContactPhone:
                        getValue(
                            "emergencyContactPhone",
                            "contactPhone"
                        ),

                    emergencyContactEmail:
                        getValue(
                            "emergencyContactEmail",
                            "contactEmail"
                        ),

                    vehicleNumber:
                        getValue(
                            "vehicleNumber"
                        ),

                    ambulanceType:
                        getValue(
                            "ambulanceType"
                        ),

                    identityDocumentType:
                        getValue(
                            "identityDocumentType"
                        ),

                    identityDocumentNumber:
                        getValue(
                            "identityDocumentNumber"
                        ),

                    driverOtp:
                        getValue(
                            "driverOtp"
                        ),

                    hospitalId:
                        getValue(
                            "hospitalId"
                        ),

                    designation:
                        getValue(
                            "designation"
                        ),

                    hospitalStaffId:
                        getValue(
                            "hospitalStaffId"
                        ),

                    hospitalDepartment:
                        getValue(
                            "hospitalDepartment"
                        ),

                    receptionName:
                        getValue(
                            "receptionName"
                        ),

                    receptionPhone:
                        getValue(
                            "receptionPhone"
                        ),

                    medicalConsent:
                        getChecked(
                            "medicalConsent",
                            "medical-consent"
                        ),

                    emergencyContactConsent:
                        getChecked(
                            "emergencyContactConsent",
                            "emergency-contact-consent"
                        ),

                    termsConsent:
                        getChecked(
                            "termsConsent",
                            "terms"
                        )

                };


                const result =
                    await registerUser(
                        formData
                    );


                if (!result.success) {
                    return;
                }


                if (
                    result.needsEmailConfirmation
                ) {

                    showAuthMessage(
                        "Account created. Please confirm your email, then sign in.",
                        "success"
                    );


                    setTimeout(
                        () => {

                            window.location.replace(
                                AUTH_PAGES.signin
                            );

                        },
                        2500
                    );


                    return;

                }


                showAuthMessage(
                    "Account created successfully.",
                    "success"
                );


                setTimeout(
                    () => {

                        redirectUserByRole(
                            result.user.id
                        );

                    },
                    500
                );


            } catch (error) {

                console.error(
                    "Signup form error:",
                    error
                );


                showAuthMessage(
                    error.message ||
                    "Unable to create account."
                );

            } finally {

                if (submitButton) {

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        originalText;

                }

            }

        }
    );

}


/* =========================================================
   SIGNIN FORM
   ========================================================= */

function setupSigninForm() {

    const form =
        document.getElementById(
            "signinForm"
        );


    if (!form) {
        return;
    }


    if (
        form.dataset.resqBound ===
        "true"
    ) {

        return;

    }


    form.dataset.resqBound =
        "true";


    form.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );


            const originalText =
                submitButton
                    ?.textContent ||
                "Sign In";


            if (submitButton) {

                submitButton.disabled =
                    true;

                submitButton.textContent =
                    "Signing In...";

            }


            try {

                await loginUser(

                    getValue(
                        "email"
                    ),

                    getValue(
                        "password"
                    )

                );

            } finally {

                if (submitButton) {

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        originalText;

                }

            }

        }
    );

}


/* =========================================================
   FORGOT PASSWORD
   ========================================================= */

function setupForgotPassword() {

    const links =
        document.querySelectorAll(
            "#forgotPassword, .forgot-password"
        );


    links.forEach(
        link => {

            if (
                link.dataset.resqBound ===
                "true"
            ) {

                return;

            }


            link.dataset.resqBound =
                "true";


            link.addEventListener(
                "click",
                async function(event) {

                    event.preventDefault();


                    await resetPassword(
                        getValue(
                            "email"
                        )
                    );

                }
            );

        }
    );

}


/* =========================================================
   LOGOUT BUTTONS
   ========================================================= */

function setupLogoutButtons() {

    const buttons =
        document.querySelectorAll(
            "#logoutBtn, #logoutButton, .logout-btn, [data-action='logout']"
        );


    buttons.forEach(
        button => {

            if (
                button.dataset.resqBound ===
                "true"
            ) {

                return;

            }


            button.dataset.resqBound =
                "true";


            button.addEventListener(
                "click",
                async function(event) {

                    event.preventDefault();

                    event.stopPropagation();


                    button.disabled =
                        true;


                    button.textContent =
                        "Signing Out...";


                    await logoutUser();

                }
            );

        }
    );

}


/* =========================================================
   BACK/FORWARD CACHE PROTECTION
   ========================================================= */

function setupPageRestoreProtection() {

    window.addEventListener(
        "pageshow",
        async function() {

            const currentPage =
                getCurrentPage();


            if (
                PROTECTED_PAGES.includes(
                    currentPage
                )
            ) {

                await protectCurrentDashboard();

            }

        }
    );

}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

function setupAuthStateListener() {

    const supabase =
        getSupabase();


    if (!supabase) {
        return;
    }


    supabase.auth.onAuthStateChange(
        (
            event,
            session
        ) => {

            const currentPage =
                getCurrentPage();


            if (
                event === "SIGNED_OUT" &&
                !session &&
                PROTECTED_PAGES.includes(
                    currentPage
                )
            ) {

                redirectToSignIn();

            }

        }
    );

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        setupSignupForm();

        setupSigninForm();

        setupForgotPassword();

        setupLogoutButtons();

        setupPageRestoreProtection();

        setupAuthStateListener();


        const currentPage =
            getCurrentPage();


        /* -----------------------------------------
           PROTECTED DASHBOARDS
        ----------------------------------------- */

        if (
            PROTECTED_PAGES.includes(
                currentPage
            )
        ) {

            await protectCurrentDashboard();

            return;

        }


        /* -----------------------------------------
           SIGN IN / SIGN UP
        ----------------------------------------- */

        if (
            currentPage ===
                AUTH_PAGES.signin ||
            currentPage ===
                AUTH_PAGES.signup
        ) {

            await redirectIfAuthenticated();

        }


        /* -----------------------------------------
           SIGNUP HOSPITAL LIST
        ----------------------------------------- */

        if (
            currentPage ===
            AUTH_PAGES.signup
        ) {

            await loadHospitalsForSignup();

        }

    }
);


/* =========================================================
   GLOBAL AUTH API
   ========================================================= */

window.resqAuth = {

    register:
        registerUser,

    login:
        loginUser,

    logout:
        logoutUser,

    resetPassword:
        resetPassword,

    requireAuth:
        requireAuthentication,

    protectDashboard:
        protectCurrentDashboard,

    redirectByRole:
        redirectUserByRole,

    redirectToSignIn:
        redirectToSignIn,

    getDashboard:
        getDashboardForRole,

    getProfile:
        getUserProfile,

    completeRoleSetup:
        completeRoleSetup

};


/* =========================================================
   MODULE LOADED
   ========================================================= */

console.log(
    "ResQ-Route authentication module loaded."
);