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
   SUPABASE
   ========================================================= */

function getSupabase() {
    if (
        window.resqRoute &&
        window.resqRoute.supabase
    ) {
        return window.resqRoute.supabase;
    }

    if (window.supabaseClient) {
        return window.supabaseClient;
    }

    console.error("Supabase client not initialized.");
    return null;
}

/* =========================================================
   HELPERS
   ========================================================= */

function getValue(id) {
    const element = document.getElementById(id);
    return element ? element.value.trim() : "";
}

function getChecked(id) {
    const element = document.getElementById(id);
    return element ? element.checked : false;
}

function normalizeRole(role) {
    if (!role) return "family";

    const value = String(role)
        .trim()
        .toLowerCase();

    if (
        value === "driver" ||
        value === "ambulance"
    ) {
        return "driver";
    }

    if (
        value === "hospital" ||
        value === "hospital_staff"
    ) {
        return "hospital";
    }

    if (
        value === "family" ||
        value === "citizen" ||
        value === "user"
    ) {
        return "family";
    }

    return value;
}

function getDashboardForRole(role) {
    const normalizedRole = normalizeRole(role);

    if (normalizedRole === "driver") {
        return AUTH_PAGES.driver;
    }

    if (normalizedRole === "hospital") {
        return AUTH_PAGES.hospital;
    }

    return AUTH_PAGES.family;
}

function showMessage(message, type = "error") {
    const possibleIds = [
        "authMessage",
        "formMessage",
        "message",
        "errorMessage"
    ];

    let container = null;

    for (const id of possibleIds) {
        const element = document.getElementById(id);

        if (element) {
            container = element;
            break;
        }
    }

    if (!container) {
        if (type === "error") {
            console.error(message);
        } else {
            console.log(message);
        }

        return;
    }

    container.textContent = message;
    container.style.display = "block";

    container.classList.remove(
        "success",
        "error",
        "warning"
    );

    container.classList.add(type);
}

function clearMessage() {
    const possibleIds = [
        "authMessage",
        "formMessage",
        "message",
        "errorMessage"
    ];

    possibleIds.forEach(id => {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = "";
            element.style.display = "none";
        }
    });
}

function setLoading(button, loading, loadingText = "Please wait...") {
    if (!button) return;

    if (loading) {
        button.dataset.originalText =
            button.textContent;

        button.disabled = true;
        button.textContent = loadingText;
    } else {
        button.disabled = false;

        if (button.dataset.originalText) {
            button.textContent =
                button.dataset.originalText;
        }
    }
}

function getCurrentPage() {
    return window.location.pathname
        .split("/")
        .pop()
        .toLowerCase();
}

/* =========================================================
   EMAIL / PHONE / PASSWORD VALIDATION
   ========================================================= */

function validateEmail(email) {
    if (!email) return false;

    const pattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return pattern.test(email);
}

function normalizePhone(phone) {
    if (!phone) return "";

    return phone
        .replace(/[^\d+]/g, "")
        .trim();
}

function validatePhone(phone) {
    const normalized =
        normalizePhone(phone);

    const digits =
        normalized.replace(/\D/g, "");

    return (
        digits.length >= 10 &&
        digits.length <= 15
    );
}

function validatePassword(password) {
    if (!password) return false;

    return password.length >= 6;
}

function validateName(name) {
    if (!name) return false;

    return name.length >= 2;
}

/* =========================================================
   PROFILE
   ========================================================= */

async function getUserProfile(userId = null) {
    const supabase = getSupabase();

    if (!supabase) {
        throw new Error(
            "Supabase is not initialized."
        );
    }

    let id = userId;

    if (!id) {
        const {
            data: {
                user
            },
            error
        } = await supabase.auth.getUser();

        if (error) throw error;

        if (!user) {
            return null;
        }

        id = user.id;
    }

    const {
        data,
        error
    } = await supabase
        .from("profiles")
        .select(
            "id,name,email,phone,role"
        )
        .eq("id", id)
        .maybeSingle();

    if (error) {
        console.error(
            "Profile fetch error:",
            error
        );

        throw error;
    }

    return data;
}

/* =========================================================
   ROLE REDIRECTION
   ========================================================= */

async function redirectUserByRole() {
    try {
        const supabase = getSupabase();

        if (!supabase) {
            return false;
        }

        const {
            data: {
                user
            }
        } = await supabase.auth.getUser();

        if (!user) {
            return false;
        }

        const profile =
            await getUserProfile(user.id);

        if (!profile) {
            console.warn(
                "No profile found for user."
            );

            return false;
        }

        const role =
            normalizeRole(profile.role);

        const dashboard =
            getDashboardForRole(role);

        window.location.href = dashboard;

        return true;
    } catch (error) {
        console.error(
            "Role redirect error:",
            error
        );

        return false;
    }
}

/* =========================================================
   DRIVER VALIDATION
   ========================================================= */

function validateVehicleNumber(vehicleNumber) {
    if (!vehicleNumber) return false;

    const value =
        vehicleNumber
            .trim()
            .toUpperCase();

    return (
        value.length >= 4 &&
        value.length <= 20
    );
}

function validateAmbulanceType(type) {
    if (!type) return false;

    const validTypes = [
        "basic",
        "advanced",
        "icu",
        "neonatal",
        "cardiac",
        "patient_transport",
        "basic_life_support",
        "advanced_life_support"
    ];

    return validTypes.includes(
        String(type)
            .trim()
            .toLowerCase()
    );
}

function validateIdentityDocument(
    documentType,
    documentNumber
) {
    if (!documentType) return false;
    if (!documentNumber) return false;

    return (
        documentNumber.trim().length >= 3
    );
}

/* =========================================================
   FAMILY VALIDATION
   ========================================================= */

function validateFamilyData(formData) {
    if (!formData) return false;

    if (
        formData.age !== undefined &&
        formData.age !== null &&
        formData.age !== ""
    ) {
        const age =
            Number(formData.age);

        if (
            Number.isNaN(age) ||
            age < 0 ||
            age > 120
        ) {
            return false;
        }
    }

    return true;
}

/* =========================================================
   DRIVER RECORD CREATION
   ========================================================= */

async function createDriverRecords(
    userId,
    formData
) {
    const supabase = getSupabase();

    if (!supabase) {
        throw new Error(
            "Supabase is not initialized."
        );
    }

    const vehicleNumber =
        formData.vehicleNumber
            .trim()
            .toUpperCase();

    const ambulanceType =
        formData.ambulanceType
            .trim()
            .toLowerCase();

    const {
        data,
        error
    } = await supabase
        .from("ambulances")
        .insert({
            vehicle_number:
                vehicleNumber,

            driver_id:
                userId,

            ambulance_type:
                ambulanceType,

            status:
                "available"
        })
        .select()
        .single();

    if (error) {
        console.error(
            "Driver record creation error:",
            error
        );

        throw error;
    }

    return data;
}

/* =========================================================
   HOSPITAL RECORD CREATION
   ========================================================= */

async function createHospitalRecords(
    userId,
    formData
) {
    const supabase = getSupabase();

    if (!supabase) {
        throw new Error(
            "Supabase is not initialized."
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
                userId,

            designation:
                formData.designation
        })
        .select()
        .single();

    if (error) {
        console.error(
            "Hospital staff creation error:",
            error
        );

        throw error;
    }

    return data;
}

/* =========================================================
   FAMILY RECORD CREATION
   ========================================================= */

async function createFamilyRecords(
    userId,
    formData
) {
    const supabase = getSupabase();

    if (!supabase) {
        throw new Error(
            "Supabase is not initialized."
        );
    }

    const familyData = {
        user_id: userId
    };

    if (formData.bloodGroup) {
        familyData.blood_group =
            formData.bloodGroup;
    }

    if (formData.allergies) {
        familyData.allergies =
            formData.allergies;
    }

    if (formData.medicalConditions) {
        familyData.medical_conditions =
            formData.medicalConditions;
    }

    if (formData.emergencyContact) {
        familyData.emergency_contact =
            formData.emergencyContact;
    }

    if (formData.emergencyContactName) {
        familyData.emergency_contact_name =
            formData.emergencyContactName;
    }

    const {
        data,
        error
    } = await supabase
        .from("patients")
        .insert(familyData)
        .select()
        .single();

    if (error) {
        console.error(
            "Family record creation error:",
            error
        );

        throw error;
    }

    return data;
}

/* =========================================================
   HOSPITAL LIST
   ========================================================= */

async function loadHospitalsForSignup() {
    const supabase = getSupabase();

    if (!supabase) {
        console.error(
            "Supabase is not initialized."
        );

        return [];
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
            );

        if (error) {
            throw error;
        }

        const hospitalSelect =
            document.getElementById(
                "hospitalId"
            );

        if (!hospitalSelect) {
            return data || [];
        }

        const currentValue =
            hospitalSelect.value;

        hospitalSelect.innerHTML =
            '<option value="">Select Hospital</option>';

        (data || []).forEach(hospital => {
            const option =
                document.createElement(
                    "option"
                );

            option.value =
                hospital.id;

            option.textContent =
                hospital.name ||
                hospital.hospital_name ||
                `Hospital ${hospital.id}`;

            hospitalSelect.appendChild(
                option
            );
        });

        if (currentValue) {
            hospitalSelect.value =
                currentValue;
        }

        return data || [];
    } catch (error) {
        console.error(
            "Hospital loading error:",
            error
        );

        return [];
    }
}

/* =========================================================
   REGISTER USER
   ========================================================= */

async function registerUser(formData) {
    clearMessage();

    const supabase = getSupabase();

    if (!supabase) {
        return {
            success: false,
            error:
                "Supabase is not initialized."
        };
    }

    try {
        if (!formData) {
            throw new Error(
                "Registration data is missing."
            );
        }

        const name =
            String(
                formData.name || ""
            ).trim();

        const email =
            String(
                formData.email || ""
            ).trim()
            .toLowerCase();

        const phone =
            normalizePhone(
                formData.phone || ""
            );

        const password =
            String(
                formData.password || ""
            );

        const role =
            normalizeRole(
                formData.role || "family"
            );

        if (!validateName(name)) {
            throw new Error(
                "Please enter a valid name."
            );
        }

        if (!validateEmail(email)) {
            throw new Error(
                "Please enter a valid email address."
            );
        }

        if (!validatePhone(phone)) {
            throw new Error(
                "Please enter a valid phone number."
            );
        }

        if (!validatePassword(password)) {
            throw new Error(
                "Password must be at least 6 characters."
            );
        }

        if (!role) {
            throw new Error(
                "Please select a valid role."
            );
        }

        if (
            formData.termsAccepted === false
        ) {
            throw new Error(
                "Please accept the terms and conditions."
            );
        }

        /* -------------------------------------------------
           FAMILY VALIDATION
           ------------------------------------------------- */

        if (role === "family") {
            if (!validateFamilyData(formData)) {
                throw new Error(
                    "Please enter valid family information."
                );
            }
        }

        /* -------------------------------------------------
           DRIVER VALIDATION
           ------------------------------------------------- */

        if (role === "driver") {
            if (
                !validateVehicleNumber(
                    formData.vehicleNumber
                )
            ) {
                throw new Error(
                    "Please enter a valid vehicle number."
                );
            }

            if (
                !validateAmbulanceType(
                    formData.ambulanceType
                )
            ) {
                throw new Error(
                    "Please select a valid ambulance type."
                );
            }

            if (
                !validateIdentityDocument(
                    formData.identityDocumentType,
                    formData.identityDocumentNumber
                )
            ) {
                throw new Error(
                    "Please provide valid identity document details."
                );
            }
        }

        /* -------------------------------------------------
           HOSPITAL VALIDATION
           ------------------------------------------------- */

        if (role === "hospital") {
            if (!formData.hospitalId) {
                throw new Error(
                    "Please select a hospital."
                );
            }

            if (!formData.designation) {
                throw new Error(
                    "Please enter your designation."
                );
            }

            if (!formData.hospitalStaffId) {
                throw new Error(
                    "Please enter your hospital staff ID."
                );
            }

            if (!formData.hospitalDepartment) {
                throw new Error(
                    "Please enter your hospital department."
                );
            }

            if (!formData.receptionName) {
                throw new Error(
                    "Please enter reception/contact name."
                );
            }

            if (
                !validatePhone(
                    formData.receptionPhone
                )
            ) {
                throw new Error(
                    "Please enter a valid reception phone number."
                );
            }
        }

        /* -------------------------------------------------
           AUTH METADATA
           ------------------------------------------------- */

        const metadata = {
            name: name,
            phone: phone,
            role: role
        };

        if (role === "family") {
            metadata.age =
                formData.age || null;

            metadata.blood_group =
                formData.bloodGroup || null;

            metadata.allergies =
                formData.allergies || null;

            metadata.medical_conditions =
                formData.medicalConditions || null;

            metadata.emergency_contact =
                formData.emergencyContact || null;

            metadata.emergency_contact_name =
                formData.emergencyContactName || null;
        }

        if (role === "driver") {
            metadata.vehicle_number =
                formData.vehicleNumber
                    .trim()
                    .toUpperCase();

            metadata.ambulance_type =
                formData.ambulanceType
                    .trim()
                    .toLowerCase();

            metadata.identity_document_type =
                formData.identityDocumentType;

            metadata.identity_verified =
                false;
        }

        if (role === "hospital") {
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

        /* -------------------------------------------------
           SUPABASE SIGNUP
           ------------------------------------------------- */

        const {
            data,
            error
        } = await supabase.auth.signUp({
            email: email,
            password: password,

            options: {
                data: metadata
            }
        });

        if (error) {
            console.error(
                "Supabase signup error:",
                error
            );

            throw error;
        }

        if (!data || !data.user) {
            throw new Error(
                "Registration failed. User was not created."
            );
        }

        const userId =
            data.user.id;

        /* -------------------------------------------------
           EMAIL CONFIRMATION
           ------------------------------------------------- */

        if (!data.session) {
            return {
                success: true,
                needsEmailConfirmation: true,
                user: data.user,
                message:
                    "Account created. Please confirm your email before signing in."
            };
        }

        /* -------------------------------------------------
           CREATE ROLE-SPECIFIC RECORD
           ------------------------------------------------- */

        try {
            if (role === "family") {
                await createFamilyRecords(
                    userId,
                    formData
                );
            }

            if (role === "driver") {
                await createDriverRecords(
                    userId,
                    formData
                );
            }

            if (role === "hospital") {
                await createHospitalRecords(
                    userId,
                    formData
                );
            }
        } catch (recordError) {
            console.error(
                "Role record creation error:",
                recordError
            );
        }

        return {
            success: true,
            needsEmailConfirmation: false,
            user: data.user,
            session: data.session,
            role: role,
            redirect:
                getDashboardForRole(role)
        };
    } catch (error) {
        console.error(
            "Registration error:",
            error
        );

        return {
            success: false,
            error:
                error.message ||
                "Registration failed."
        };
    }
}

/* =========================================================
   COMPLETE ROLE SETUP
   ========================================================= */

async function completeRoleSetup(
    user,
    profile = null
) {
    const supabase = getSupabase();

    if (!supabase || !user) {
        return false;
    }

    try {
        const metadata =
            user.user_metadata || {};

        const role =
            normalizeRole(
                metadata.role ||
                (profile && profile.role)
            );

        if (role === "driver") {
            const vehicleNumber =
                metadata.vehicle_number;

            const ambulanceType =
                metadata.ambulance_type;

            if (
                vehicleNumber &&
                ambulanceType
            ) {
                const {
                    data: existingAmbulance,
                    error: checkError
                } = await supabase
                    .from("ambulances")
                    .select("id")
                    .eq(
                        "driver_id",
                        user.id
                    )
                    .maybeSingle();

                if (checkError) {
                    console.error(
                        "Ambulance lookup error:",
                        checkError
                    );
                }

                if (!existingAmbulance) {
                    try {
                        await supabase
                            .from("ambulances")
                            .insert({
                                vehicle_number:
                                    vehicleNumber
                                        .trim()
                                        .toUpperCase(),

                                driver_id:
                                    user.id,

                                ambulance_type:
                                    ambulanceType
                                        .trim()
                                        .toLowerCase(),

                                status:
                                    "available"
                            });
                    } catch (error) {
                        console.error(
                            "Ambulance setup error:",
                            error
                        );
                    }
                }
            }
        }

        if (role === "hospital") {
            const hospitalId =
                metadata.hospital_id;

            const designation =
                metadata.designation;

            if (
                hospitalId &&
                designation
            ) {
                const {
                    data: existingStaff,
                    error: checkError
                } = await supabase
                    .from("hospital_staff")
                    .select("id")
                    .eq(
                        "user_id",
                        user.id
                    )
                    .maybeSingle();

                if (checkError) {
                    console.error(
                        "Hospital staff lookup error:",
                        checkError
                    );
                }

                if (!existingStaff) {
                    try {
                        await supabase
                            .from("hospital_staff")
                            .insert({
                                hospital_id:
                                    hospitalId,

                                user_id:
                                    user.id,

                                designation:
                                    designation
                            });
                    } catch (error) {
                        console.error(
                            "Hospital setup error:",
                            error
                        );
                    }
                }
            }
        }

        return true;
    } catch (error) {
        console.error(
            "Role setup error:",
            error
        );

        return false;
    }
}

/* =========================================================
   LOGIN
   ========================================================= */

async function loginUser(
    email,
    password
) {
    clearMessage();

    const supabase = getSupabase();

    if (!supabase) {
        return {
            success: false,
            error:
                "Supabase is not initialized."
        };
    }

    try {
        const normalizedEmail =
            String(email || "")
                .trim()
                .toLowerCase();

        if (
            !validateEmail(
                normalizedEmail
            )
        ) {
            throw new Error(
                "Please enter a valid email address."
            );
        }

        if (!password) {
            throw new Error(
                "Please enter your password."
            );
        }

        const {
            data,
            error
        } = await supabase.auth.signInWithPassword({
            email:
                normalizedEmail,

            password:
                password
        });

        if (error) {
            throw error;
        }

        if (!data || !data.user) {
            throw new Error(
                "Login failed."
            );
        }

        let profile = null;

        try {
            profile =
                await getUserProfile(
                    data.user.id
                );
        } catch (profileError) {
            console.error(
                "Profile loading error:",
                profileError
            );
        }

        await completeRoleSetup(
            data.user,
            profile
        );

        const role =
            normalizeRole(
                profile &&
                profile.role
                    ? profile.role
                    : data.user.user_metadata &&
                      data.user.user_metadata.role
            );

        const redirect =
            getDashboardForRole(role);

        return {
            success: true,
            user: data.user,
            session: data.session,
            profile: profile,
            role: role,
            redirect: redirect
        };
    } catch (error) {
        console.error(
            "Login error:",
            error
        );

        return {
            success: false,
            error:
                error.message ||
                "Login failed."
        };
    }
}

/* =========================================================
   PASSWORD RESET
   ========================================================= */

async function resetPassword(
    email
) {
    const supabase = getSupabase();

    if (!supabase) {
        return {
            success: false,
            error:
                "Supabase is not initialized."
        };
    }

    try {
        const normalizedEmail =
            String(email || "")
                .trim()
                .toLowerCase();

        if (
            !validateEmail(
                normalizedEmail
            )
        ) {
            throw new Error(
                "Please enter a valid email address."
            );
        }

        const redirectUrl =
            `${window.location.origin}/reset-password.html`;

        const {
            error
        } = await supabase.auth.resetPasswordForEmail(
            normalizedEmail,
            {
                redirectTo:
                    redirectUrl
            }
        );

        if (error) {
            throw error;
        }

        return {
            success: true,
            message:
                "Password reset email sent."
        };
    } catch (error) {
        console.error(
            "Password reset error:",
            error
        );

        return {
            success: false,
            error:
                error.message ||
                "Unable to send password reset email."
        };
    }
}

/* =========================================================
   LOGOUT
   ========================================================= */

async function logoutUser() {
    const supabase = getSupabase();

    if (!supabase) {
        window.location.href =
            AUTH_PAGES.signin;

        return;
    }

    try {
        const {
            error
        } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }
    } catch (error) {
        console.error(
            "Logout error:",
            error
        );
    }

    window.location.href =
        AUTH_PAGES.signin;
}

/* =========================================================
   AUTH STATE
   ========================================================= */

async function getCurrentUser() {
    const supabase = getSupabase();

    if (!supabase) {
        return null;
    }

    try {
        const {
            data: {
                user
            },
            error
        } = await supabase.auth.getUser();

        if (error) {
            console.error(
                "Get current user error:",
                error
            );

            return null;
        }

        return user || null;
    } catch (error) {
        console.error(
            "Current user error:",
            error
        );

        return null;
    }
}

/* =========================================================
   AUTH GUARDS
   ========================================================= */

async function requireAuth() {
    const user =
        await getCurrentUser();

    if (!user) {
        const currentPage =
            getCurrentPage();

        const encoded =
            encodeURIComponent(
                currentPage
            );

        window.location.href =
            `${AUTH_PAGES.signin}?redirect=${encoded}`;

        return null;
    }

    return user;
}

async function protectDashboard() {
    const user =
        await requireAuth();

    if (!user) {
        return false;
    }

    try {
        const profile =
            await getUserProfile(
                user.id
            );

        if (!profile) {
            window.location.href =
                AUTH_PAGES.signin;

            return false;
        }

        const currentPage =
            getCurrentPage();

        const expectedPage =
            getDashboardForRole(
                profile.role
            ).toLowerCase();

        if (
            currentPage &&
            currentPage !== expectedPage
        ) {
            window.location.href =
                expectedPage;

            return false;
        }

        return true;
    } catch (error) {
        console.error(
            "Dashboard protection error:",
            error
        );

        return false;
    }
}

/* =========================================================
   REDIRECT IF ALREADY LOGGED IN
   ========================================================= */

async function redirectIfAuthenticated() {
    const currentPage =
        getCurrentPage();

    const authPages = [
        "signin.html",
        "signup.html"
    ];

    if (
        !authPages.includes(
            currentPage
        )
    ) {
        return false;
    }

    const user =
        await getCurrentUser();

    if (!user) {
        return false;
    }

    return await redirectUserByRole();
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
        form.dataset.authBound === "true"
    ) {
        return;
    }

    form.dataset.authBound = "true";

    form.addEventListener(
        "submit",
        async function(event) {
            event.preventDefault();

            clearMessage();

            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );

            setLoading(
                submitButton,
                true,
                "Creating account..."
            );

            try {
                const roleElement =
                    document.getElementById(
                        "role"
                    ) ||
                    document.querySelector(
                        'input[name="role"]:checked'
                    );

                let role = "";

                if (
                    roleElement &&
                    roleElement.type ===
                        "radio"
                ) {
                    const checked =
                        document.querySelector(
                            'input[name="role"]:checked'
                        );

                    role =
                        checked
                            ? checked.value
                            : "";
                } else if (
                    roleElement
                ) {
                    role =
                        roleElement.value;
                }

                const formData = {
                    name:
                        getValue("name"),

                    email:
                        getValue("email"),

                    phone:
                        getValue("phone"),

                    password:
                        getValue("password"),

                    role:
                        role,

                    termsAccepted:
                        getChecked(
                            "termsAccepted"
                        ) ||
                        getChecked("terms") ||
                        true,

                    age:
                        getValue("age"),

                    bloodGroup:
                        getValue(
                            "bloodGroup"
                        ),

                    allergies:
                        getValue(
                            "allergies"
                        ),

                    medicalConditions:
                        getValue(
                            "medicalConditions"
                        ),

                    emergencyContact:
                        getValue(
                            "emergencyContact"
                        ),

                    emergencyContactName:
                        getValue(
                            "emergencyContactName"
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
                        )
                };

                const result =
                    await registerUser(
                        formData
                    );

                if (!result.success) {
                    showMessage(
                        result.error ||
                        "Registration failed.",
                        "error"
                    );

                    return;
                }

                if (
                    result.needsEmailConfirmation
                ) {
                    showMessage(
                        result.message ||
                        "Account created. Please confirm your email.",
                        "success"
                    );

                    setTimeout(
                        () => {
                            window.location.href =
                                AUTH_PAGES.signin;
                        },
                        2000
                    );

                    return;
                }

                showMessage(
                    "Account created successfully. Redirecting...",
                    "success"
                );

                setTimeout(
                    () => {
                        window.location.href =
                            result.redirect ||
                            getDashboardForRole(
                                result.role
                            );
                    },
                    500
                );
            } catch (error) {
                console.error(
                    "Signup form error:",
                    error
                );

                showMessage(
                    error.message ||
                    "Registration failed.",
                    "error"
                );
            } finally {
                setLoading(
                    submitButton,
                    false
                );
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
        form.dataset.authBound === "true"
    ) {
        return;
    }

    form.dataset.authBound = "true";

    form.addEventListener(
        "submit",
        async function(event) {
            event.preventDefault();

            clearMessage();

            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );

            setLoading(
                submitButton,
                true,
                "Signing in..."
            );

            try {
                const email =
                    getValue("email");

                const password =
                    getValue("password");

                const result =
                    await loginUser(
                        email,
                        password
                    );

                if (!result.success) {
                    showMessage(
                        result.error ||
                        "Login failed.",
                        "error"
                    );

                    return;
                }

                showMessage(
                    "Login successful. Redirecting...",
                    "success"
                );

                const redirect =
                    result.redirect ||
                    getDashboardForRole(
                        result.role
                    );

                setTimeout(
                    () => {
                        window.location.href =
                            redirect;
                    },
                    300
                );
            } catch (error) {
                console.error(
                    "Signin form error:",
                    error
                );

                showMessage(
                    error.message ||
                    "Login failed.",
                    "error"
                );
            } finally {
                setLoading(
                    submitButton,
                    false
                );
            }
        }
    );
}

/* =========================================================
   LOGOUT BUTTONS
   ========================================================= */

function setupLogoutButtons() {
    const selectors = [
        "#logoutBtn",
        "#logoutButton",
        '[data-action="logout"]'
    ];

    selectors.forEach(selector => {
        document
            .querySelectorAll(selector)
            .forEach(button => {
                if (
                    button.dataset.authBound ===
                    "true"
                ) {
                    return;
                }

                button.dataset.authBound =
                    "true";

                button.addEventListener(
                    "click",
                    async function(event) {
                        event.preventDefault();

                        await logoutUser();
                    }
                );
            });
    });
}

/* =========================================================
   PASSWORD RESET FORM
   ========================================================= */

function setupPasswordResetForm() {
    const form =
        document.getElementById(
            "resetPasswordForm"
        );

    if (!form) {
        return;
    }

    if (
        form.dataset.authBound === "true"
    ) {
        return;
    }

    form.dataset.authBound = "true";

    form.addEventListener(
        "submit",
        async function(event) {
            event.preventDefault();

            clearMessage();

            const email =
                getValue("email");

            const button =
                form.querySelector(
                    'button[type="submit"]'
                );

            setLoading(
                button,
                true,
                "Sending..."
            );

            try {
                const result =
                    await resetPassword(
                        email
                    );

                if (!result.success) {
                    showMessage(
                        result.error,
                        "error"
                    );

                    return;
                }

                showMessage(
                    result.message,
                    "success"
                );
            } catch (error) {
                console.error(
                    "Reset form error:",
                    error
                );

                showMessage(
                    error.message ||
                    "Unable to reset password.",
                    "error"
                );
            } finally {
                setLoading(
                    button,
                    false
                );
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

    if (
        window.__resqAuthStateListenerSet
    ) {
        return;
    }

    window.__resqAuthStateListenerSet =
        true;

    supabase.auth.onAuthStateChange(
        async (event, session) => {
            console.log(
                "Auth state:",
                event
            );

            if (
                event ===
                    "SIGNED_OUT"
            ) {
                return;
            }

            if (
                event ===
                    "SIGNED_IN" &&
                session &&
                session.user
            ) {
                try {
                    await completeRoleSetup(
                        session.user
                    );
                } catch (error) {
                    console.error(
                        "Auth state role setup error:",
                        error
                    );
                }
            }
        }
    );
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initializeAuth() {
    try {
        setupAuthStateListener();

        setupSignupForm();
        setupSigninForm();
        setupLogoutButtons();
        setupPasswordResetForm();

        const currentPage =
            getCurrentPage();

        if (
            currentPage ===
            "signup.html"
        ) {
            await loadHospitalsForSignup();
        }

        if (
            currentPage ===
                "signin.html" ||
            currentPage ===
                "signup.html"
        ) {
            await redirectIfAuthenticated();
        }

        if (
            PROTECTED_PAGES.includes(
                currentPage
            )
        ) {
            await protectDashboard();
        }
    } catch (error) {
        console.error(
            "Auth initialization error:",
            error
        );
    }
}

/* =========================================================
   GLOBAL API
   ========================================================= */

window.resqAuth = {
    registerUser,
    loginUser,
    logoutUser,
    resetPassword,

    getCurrentUser,
    getUserProfile,

    requireAuth,
    protectDashboard,

    redirectUserByRole,
    redirectByRole:
        redirectUserByRole,

    getDashboardForRole,
    normalizeRole,

    completeRoleSetup,

    createDriverRecords,
    createHospitalRecords,
    createFamilyRecords,

    loadHospitalsForSignup
};

/* =========================================================
   DOM READY
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initializeAuth
    );
} else {
    initializeAuth();
}