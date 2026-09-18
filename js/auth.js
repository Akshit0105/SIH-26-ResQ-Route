
(function () {
    "use strict";

    /* =========================================================
       RESQ-ROUTE
       AUTHENTICATION & USER MANAGEMENT
       ========================================================= */


    /* =========================================================
       PAGE CONFIGURATION
       ========================================================= */

    var AUTH_PAGES = {
        signin: "signin.html",
        signup: "signup.html",
        emergency: "emergency.html",
        family: "family.html",
        driver: "ambulance.html",
        hospital: "hospital.html"
    };

    var PROTECTED_PAGES = [
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

        console.error(
            "ResQ-Route: Supabase client not initialized."
        );

        return null;
    }


    /* =========================================================
       HELPERS
       ========================================================= */

    function getValue(id) {

        var element =
            document.getElementById(id);

        if (!element) {
            return "";
        }

        return String(
            element.value || ""
        ).trim();
    }


    function getChecked(id) {

        var element =
            document.getElementById(id);

        return !!(
            element &&
            element.checked
        );
    }


    function getCurrentPage() {

        return window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();
    }


    function normalizeRole(role) {

        if (!role) {
            return "";
        }

        var value =
            String(role)
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

        var normalized =
            normalizeRole(role);

        if (normalized === "driver") {
            return AUTH_PAGES.driver;
        }

        if (normalized === "hospital") {
            return AUTH_PAGES.hospital;
        }

        if (normalized === "family") {
            return AUTH_PAGES.family;
        }

        return null;
    }


    /* =========================================================
       MESSAGE
       ========================================================= */

    function showMessage(
        message,
        type
    ) {

        var ids = [
            "statusMessage",
            "authMessage",
            "formMessage",
            "message",
            "errorMessage"
        ];

        var element = null;

        for (
            var i = 0;
            i < ids.length;
            i++
        ) {

            var found =
                document.getElementById(
                    ids[i]
                );

            if (found) {
                element = found;
                break;
            }
        }

        if (!element) {

            if (type === "error") {
                console.error(message);
            } else {
                console.log(message);
            }

            return;
        }

        element.textContent =
            message;

        element.style.display =
            "block";

        element.classList.remove(
            "success",
            "error",
            "warning",
            "loading"
        );

        element.classList.add(
            type || "error"
        );
    }


    function clearMessage() {

        var ids = [
            "statusMessage",
            "authMessage",
            "formMessage",
            "message",
            "errorMessage"
        ];

        ids.forEach(
            function (id) {

                var element =
                    document.getElementById(
                        id
                    );

                if (!element) {
                    return;
                }

                element.textContent =
                    "";

                element.style.display =
                    "none";

                element.classList.remove(
                    "success",
                    "error",
                    "warning",
                    "loading"
                );
            }
        );
    }


    /* =========================================================
       LOADING BUTTON
       ========================================================= */

    function setLoading(
        button,
        loading,
        loadingText
    ) {

        if (!button) {
            return;
        }

        if (loading) {

            if (
                !button.dataset.originalText
            ) {
                button.dataset.originalText =
                    button.textContent;
            }

            button.disabled =
                true;

            button.textContent =
                loadingText ||
                "Please wait...";

        } else {

            button.disabled =
                false;

            if (
                button.dataset.originalText
            ) {

                button.textContent =
                    button.dataset.originalText;

                delete button.dataset.originalText;
            }
        }
    }


    /* =========================================================
       VALIDATION
       ========================================================= */

    function validateEmail(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(email);
    }


    function normalizePhone(phone) {

        return String(
            phone || ""
        ).replace(
            /[^\d+]/g,
            ""
        );
    }


    function validatePhone(phone) {

        var normalized =
            normalizePhone(phone);

        var digits =
            normalized.replace(
                /\D/g,
                ""
            );

        return (
            digits.length >= 10 &&
            digits.length <= 15
        );
    }


    function validatePassword(password) {

        return (
            typeof password === "string" &&
            password.length >= 6
        );
    }


    function validateName(name) {

        return (
            typeof name === "string" &&
            name.trim().length >= 2
        );
    }


    function validateVehicleNumber(
        vehicleNumber
    ) {

        if (!vehicleNumber) {
            return false;
        }

        var value =
            vehicleNumber
                .trim()
                .toUpperCase()
                .replace(
                    /[\s-]/g,
                    ""
                );

        return (
            value.length >= 5 &&
            value.length <= 15 &&
            /^[A-Z0-9]+$/.test(value)
        );
    }


    function validateAmbulanceType(
        type
    ) {

        if (!type) {
            return false;
        }

        return String(type)
            .trim()
            .length > 0;
    }


    function validateIdentityDocument(
        documentType,
        documentNumber
    ) {

        if (
            !documentType ||
            !documentNumber
        ) {
            return false;
        }

        var type =
            String(documentType)
                .trim()
                .toLowerCase();

        var number =
            String(documentNumber)
                .trim()
                .toUpperCase();

        if (type === "aadhaar") {

            return /^\d{12}$/
                .test(number);
        }

        if (type === "pan") {

            return /^[A-Z]{5}\d{4}[A-Z]$/
                .test(number);
        }

        if (
            type === "driving_license"
        ) {

            return number.length >= 3;
        }

        return number.length >= 3;
    }


    /* =========================================================
       USER PROFILE
       ========================================================= */

    async function getUserProfile(
        userId
    ) {

        var supabase =
            getSupabase();

        if (!supabase) {
            return null;
        }

        try {

            var id =
                userId;

            if (!id) {

                var userResult =
                    await supabase.auth
                        .getUser();

                if (
                    userResult.error ||
                    !userResult.data.user
                ) {
                    return null;
                }

                id =
                    userResult.data.user.id;
            }

            var result =
                await supabase
                    .from("profiles")
                    .select(
                        "id,name,email,phone,role"
                    )
                    .eq(
                        "id",
                        id
                    )
                    .maybeSingle();

            if (result.error) {

                console.error(
                    "Profile fetch error:",
                    result.error
                );

                return null;
            }

            return result.data || null;

        } catch (error) {

            console.error(
                "Profile error:",
                error
            );

            return null;
        }
    }


    /* =========================================================
       CURRENT USER
       ========================================================= */

    async function getCurrentUser() {

        var supabase =
            getSupabase();

        if (!supabase) {
            return null;
        }

        try {

            var result =
                await supabase.auth
                    .getUser();

            if (
                result.error ||
                !result.data
            ) {
                return null;
            }

            return result.data.user || null;

        } catch (error) {

            console.error(
                "Current user error:",
                error
            );

            return null;
        }
    }


    /* =========================================================
       REDIRECT BY ROLE
       ========================================================= */

    async function redirectUserByRole(
        user
    ) {

        var supabase =
            getSupabase();

        if (!supabase) {
            return false;
        }

        try {

            if (!user) {

                user =
                    await getCurrentUser();
            }

            if (!user) {
                return false;
            }

            var profile =
                await getUserProfile(
                    user.id
                );

            var role = "";

            if (
                profile &&
                profile.role
            ) {

                role =
                    profile.role;
            }

            if (
                !role &&
                user.user_metadata
            ) {

                role =
                    user.user_metadata.role;
            }

            role =
                normalizeRole(role);

            var dashboard =
                getDashboardForRole(
                    role
                );

            if (!dashboard) {

                console.error(
                    "Invalid account role:",
                    role
                );

                return false;
            }

            console.log(
                "Redirecting:",
                role,
                "->",
                dashboard
            );

            window.location.replace(
                dashboard
            );

            return true;

        } catch (error) {

            console.error(
                "Redirect error:",
                error
            );

            return false;
        }
    }


    /* =========================================================
       FAMILY RECORD
       ========================================================= */

    async function createFamilyRecords(
        userId,
        formData
    ) {

        var supabase =
            getSupabase();

        if (!supabase) {
            throw new Error(
                "Supabase is not initialized."
            );
        }

        var record = {

            user_id:
                userId,

            name:
                formData.patientName ||
                formData.name ||
                "Emergency Patient",

            blood_group:
                formData.bloodGroup ||
                null,

            allergies:
                formData.allergies ||
                null,

            medical_conditions:
                formData.medicalConditions ||
                null,
        };

        var result =
            await supabase
                .from("patients")
                .insert(record)
                .select()
                .maybeSingle();

        if (result.error) {

            console.error(
                "Family record error:",
                result.error
            );

            throw result.error;
        }

        return result.data;
    }


    /* =========================================================
       DRIVER RECORD
       ========================================================= */

    async function createDriverRecords(
        userId,
        formData
    ) {

        var supabase =
            getSupabase();

        if (!supabase) {
            throw new Error(
                "Supabase is not initialized."
            );
        }

        var record = {

            vehicle_number:
                String(
                    formData.vehicleNumber ||
                    ""
                )
                .trim()
                .toUpperCase(),

            driver_id:
                userId,

            ambulance_type:
                String(
                    formData.ambulanceType ||
                    ""
                )
                .trim()
                .toLowerCase(),

            status:
                "available"
        };

        var result =
            await supabase
                .from("ambulances")
                .insert(record)
                .select()
                .maybeSingle();

        if (result.error) {

            console.error(
                "Driver record error:",
                result.error
            );

            throw result.error;
        }

        return result.data;
    }


    /* =========================================================
       HOSPITAL RECORD
       ========================================================= */

    async function createHospitalRecords(
        userId,
        formData
    ) {

        var supabase =
            getSupabase();

        if (!supabase) {
            throw new Error(
                "Supabase is not initialized."
            );
        }

        var record = {

            hospital_id:
                formData.hospitalId,

            user_id:
                userId,

            designation:
                formData.designation,

            staff_id:
                formData.hospitalStaffId ||
                null,

            department:
                formData.hospitalDepartment ||
                null,

            reception_name:
                formData.receptionName ||
                null,

            reception_phone:
                formData.receptionPhone ||
                null
        };

        var result =
            await supabase
                .from("hospital_staff")
                .insert(record)
                .select()
                .maybeSingle();

        if (result.error) {

            console.error(
                "Hospital record error:",
                result.error
            );

            throw result.error;
        }

        return result.data;
    }


    /* =========================================================
       LOAD HOSPITALS
       ========================================================= */

    async function loadHospitalsForSignup() {

        var supabase =
            getSupabase();

        if (!supabase) {
            return;
        }

        var select =
            document.getElementById(
                "hospitalId"
            );

        if (!select) {
            return;
        }

        try {

            var result =
                await supabase
                    .from("hospitals")
                    .select(
                        "id,name"
                    )
                    .eq(
                        "emergency_available",
                        true
                    )
                    .order(
                        "name",
                        {
                            ascending: true
                        }
                    );

            if (result.error) {

                console.error(
                    "Hospital loading error:",
                    result.error
                );

                return;
            }

            select.innerHTML =
                '<option value="">Select Hospital</option>';

            (
                result.data || []
            ).forEach(
                function (hospital) {

                    var option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        hospital.id;

                    option.textContent =
                        hospital.name;

                    select.appendChild(
                        option
                    );
                }
            );

        } catch (error) {

            console.error(
                "Hospital loading error:",
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

        var supabase =
            getSupabase();

        if (!supabase) {

            return {
                success: false,
                error:
                    "Supabase is not initialized."
            };
        }

        try {

            var name =
                String(
                    formData.name || ""
                ).trim();

            var email =
                String(
                    formData.email || ""
                )
                .trim()
                .toLowerCase();

            var phone =
                normalizePhone(
                    formData.phone
                );

            var password =
                String(
                    formData.password || ""
                );

            var role =
                normalizeRole(
                    formData.role
                );


            /* =============================================
               BASIC VALIDATION
               ============================================= */

            if (!validateName(name)) {

                throw new Error(
                    "Please enter your full name."
                );
            }

            if (!validateEmail(email)) {

                throw new Error(
                    "Please enter a valid email address."
                );
            }

            if (!validatePhone(phone)) {

                throw new Error(
                    "Please enter a valid mobile number."
                );
            }

            if (!validatePassword(password)) {

                throw new Error(
                    "Password must be at least 6 characters."
                );
            }

            if (
                ![
                    "family",
                    "driver",
                    "hospital"
                ].includes(role)
            ) {

                throw new Error(
                    "Please select a valid account role."
                );
            }

            if (!formData.termsAccepted) {

                throw new Error(
                    "Please accept the Terms and Conditions."
                );
            }


            /* =============================================
               PASSWORD MATCH
               ============================================= */

            if (
                password !==
                String(
                    formData.confirmPassword ||
                    ""
                )
            ) {

                throw new Error(
                    "Passwords do not match."
                );
            }


            /* =============================================
               FAMILY
               ============================================= */

            if (
                role === "family"
            ) {

                if (
                    !formData.contactName
                ) {

                    throw new Error(
                        "Please enter emergency contact name."
                    );
                }

                if (
                    !formData.contactRelationship
                ) {

                    throw new Error(
                        "Please enter emergency contact relationship."
                    );
                }

                if (
                    !validatePhone(
                        formData.contactPhone
                    )
                ) {

                    throw new Error(
                        "Please enter a valid emergency contact phone number."
                    );
                }

                if (
                    !formData.medicalConsent
                ) {

                    throw new Error(
                        "Please provide medical information consent."
                    );
                }

                if (
                    !formData.emergencyContactConsent
                ) {

                    throw new Error(
                        "Please provide emergency contact consent."
                    );
                }
            }


            /* =============================================
               DRIVER
               ============================================= */

            if (
                role === "driver"
            ) {

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
                        "Please select an ambulance type."
                    );
                }

                if (
                    !validateIdentityDocument(
                        formData.identityDocumentType,
                        formData.identityDocumentNumber
                    )
                ) {

                    throw new Error(
                        "Please enter valid identity document details."
                    );
                }
            }


            /* =============================================
               HOSPITAL
               ============================================= */

            if (
                role === "hospital"
            ) {

                if (
                    !formData.hospitalId
                ) {

                    throw new Error(
                        "Please select a hospital."
                    );
                }

                if (
                    !formData.designation
                ) {

                    throw new Error(
                        "Please enter your designation."
                    );
                }

                if (
                    !formData.hospitalStaffId
                ) {

                    throw new Error(
                        "Please enter your hospital staff ID."
                    );
                }

                if (
                    !formData.hospitalDepartment
                ) {

                    throw new Error(
                        "Please enter your hospital department."
                    );
                }

                if (
                    !formData.receptionName
                ) {

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


            /* =============================================
               USER METADATA
               ============================================= */

            var metadata = {

                name:
                    name,

                full_name:
                    name,

                phone:
                    phone,

                role:
                    role
            };


            if (
                role === "family"
            ) {

                metadata.age =
                    formData.age ||
                    null;

                metadata.blood_group =
                    formData.bloodGroup ||
                    null;

                metadata.allergies =
                    formData.allergies ||
                    null;

                metadata.medical_conditions =
                    formData.medicalConditions ||
                    null;

                metadata.emergency_contact_name =
                    formData.contactName ||
                    null;

                metadata.emergency_contact_relationship =
                    formData.contactRelationship ||
                    null;

                metadata.emergency_contact =
                    formData.contactPhone ||
                    null;
            }


            if (
                role === "driver"
            ) {

                metadata.vehicle_number =
                    String(
                        formData.vehicleNumber ||
                        ""
                    )
                    .trim()
                    .toUpperCase();

                metadata.ambulance_type =
                    String(
                        formData.ambulanceType ||
                        ""
                    )
                    .trim()
                    .toLowerCase();

                metadata.identity_document_type =
                    formData.identityDocumentType ||
                    "";

                metadata.identity_document_number =
                    formData.identityDocumentNumber ||
                    "";
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


            /* =============================================
               SUPABASE SIGN UP
               ============================================= */

            console.log(
                "Creating Supabase account..."
            );

            var result =
                await supabase.auth.signUp({

                    email:
                        email,

                    password:
                        password,

                    options: {

                        data:
                            metadata
                    }
                });


            if (result.error) {

                console.error(
                    "Supabase signup error:",
                    result.error
                );

                throw result.error;
            }


            var user =
                result.data &&
                result.data.user;

            var session =
                result.data &&
                result.data.session;


            if (!user) {

                throw new Error(
                    "Account could not be created."
                );
            }


            /* =============================================
               EMAIL CONFIRMATION
               ============================================= */

            if (!session) {

                return {

                    success:
                        true,

                    needsEmailConfirmation:
                        true,

                    user:
                        user,

                    role:
                        role,

                    message:
                        "Account created successfully. Please verify your email before signing in."
                };
            }


            /* =============================================
               ROLE RECORD
               ============================================= */

            try {

                if (
                    role === "family"
                ) {

                    await createFamilyRecords(
                        user.id,
                        formData
                    );
                }

                if (
                    role === "driver"
                ) {

                    await createDriverRecords(
                        user.id,
                        formData
                    );
                }

                if (
                    role === "hospital"
                ) {

                    await createHospitalRecords(
                        user.id,
                        formData
                    );
                }

            } catch (recordError) {

                console.error(
                    "Role record creation error:",
                    recordError
                );

                /*
                 * Account creation succeeded.
                 * Do not stop navigation because
                 * a secondary table failed.
                 */
            }


            return {

                success:
                    true,

                needsEmailConfirmation:
                    false,

                user:
                    user,

                session:
                    session,

                role:
                    role,

                redirect:
                    getDashboardForRole(
                        role
                    )
            };

        } catch (error) {

            console.error(
                "Registration error:",
                error
            );

            return {

                success:
                    false,

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
        user
    ) {

        if (!user) {
            return false;
        }

        var supabase =
            getSupabase();

        if (!supabase) {
            return false;
        }

        try {

            var metadata =
                user.user_metadata ||
                {};

            var role =
                normalizeRole(
                    metadata.role
                );


            if (
                role === "driver"
            ) {

                var vehicleNumber =
                    metadata.vehicle_number;

                var ambulanceType =
                    metadata.ambulance_type;

                if (
                    vehicleNumber &&
                    ambulanceType
                ) {

                    var existingDriver =
                        await supabase
                            .from("ambulances")
                            .select("id")
                            .eq(
                                "driver_id",
                                user.id
                            )
                            .maybeSingle();

                    if (
                        !existingDriver.data
                    ) {

                        await supabase
                            .from("ambulances")
                            .insert({

                                vehicle_number:
                                    vehicleNumber,

                                driver_id:
                                    user.id,

                                ambulance_type:
                                    ambulanceType,

                                status:
                                    "available"
                            });
                    }
                }
            }


            if (
                role === "hospital"
            ) {

                var hospitalId =
                    metadata.hospital_id;

                var designation =
                    metadata.designation;

                if (
                    hospitalId &&
                    designation
                ) {

                    var existingStaff =
                        await supabase
                            .from("hospital_staff")
                            .select("id")
                            .eq(
                                "user_id",
                                user.id
                            )
                            .maybeSingle();

                    if (
                        !existingStaff.data
                    ) {

                        await supabase
                            .from("hospital_staff")
                            .insert({

                                hospital_id:
                                    hospitalId,

                                user_id:
                                    user.id,

                                designation:
                                    designation,

                                staff_id:
                                    metadata.hospital_staff_id ||
                                    null,

                                department:
                                    metadata.hospital_department ||
                                    null,

                                reception_name:
                                    metadata.reception_name ||
                                    null,

                                reception_phone:
                                    metadata.reception_phone ||
                                    null
                            });
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

        var supabase =
            getSupabase();

        if (!supabase) {

            return {
                success: false,
                error:
                    "Supabase is not initialized."
            };
        }

        try {

            var normalizedEmail =
                String(
                    email || ""
                )
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

            var result =
                await supabase.auth
                    .signInWithPassword({

                        email:
                            normalizedEmail,

                        password:
                            password
                    });

            if (result.error) {
                throw result.error;
            }

            if (
                !result.data ||
                !result.data.user
            ) {

                throw new Error(
                    "Login failed."
                );
            }

            var profile =
                await getUserProfile(
                    result.data.user.id
                );

            var role =
                profile &&
                profile.role
                    ? profile.role
                    : (
                        result.data.user
                            .user_metadata &&
                        result.data.user
                            .user_metadata.role
                    );

            role =
                normalizeRole(role);

            return {

                success:
                    true,

                user:
                    result.data.user,

                session:
                    result.data.session,

                profile:
                    profile,

                role:
                    role,

                redirect:
                    getDashboardForRole(
                        role
                    )
            };

        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            return {

                success:
                    false,

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

        var supabase =
            getSupabase();

        if (!supabase) {

            return {

                success:
                    false,

                error:
                    "Supabase is not initialized."
            };
        }

        try {

            var normalizedEmail =
                String(
                    email || ""
                )
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

            var result =
                await supabase.auth
                    .resetPasswordForEmail(
                        normalizedEmail,
                        {
                            redirectTo:
                                window.location.origin +
                                "/reset-password.html"
                        }
                    );

            if (result.error) {
                throw result.error;
            }

            return {

                success:
                    true,

                message:
                    "Password reset email sent successfully."
            };

        } catch (error) {

            return {

                success:
                    false,

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

        var supabase =
            getSupabase();

        try {

            if (supabase) {

                await supabase.auth
                    .signOut();
            }

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );
        }

        window.location.replace(
            AUTH_PAGES.signin
        );
    }


    /* =========================================================
       REQUIRE AUTH
       ========================================================= */

    async function requireAuth() {

        var user =
            await getCurrentUser();

        if (!user) {

            window.location.replace(
                AUTH_PAGES.signin
            );

            return null;
        }

        return user;
    }


    /* =========================================================
       PROTECT DASHBOARD
       ========================================================= */

    async function protectDashboard() {

        var currentPage =
            getCurrentPage();

        if (
            !PROTECTED_PAGES.includes(
                currentPage
            )
        ) {
            return true;
        }

        var user =
            await getCurrentUser();

        if (!user) {

            window.location.replace(
                AUTH_PAGES.signin
            );

            return false;
        }

        var profile =
            await getUserProfile(
                user.id
            );

        var role =
            profile &&
            profile.role
                ? profile.role
                : (
                    user.user_metadata &&
                    user.user_metadata.role
                );

        role =
            normalizeRole(role);

        var expectedPage =
            getDashboardForRole(
                role
            );

        if (
            expectedPage &&
            expectedPage !== currentPage
        ) {

            window.location.replace(
                expectedPage
            );

            return false;
        }

        return true;
    }


    /* =========================================================
       REDIRECT IF AUTHENTICATED
       ========================================================= */

    async function redirectIfAuthenticated() {

        var currentPage =
            getCurrentPage();

        if (
            currentPage !==
                AUTH_PAGES.signin &&
            currentPage !==
                AUTH_PAGES.signup
        ) {
            return false;
        }

        var user =
            await getCurrentUser();

        if (!user) {
            return false;
        }

        return await redirectUserByRole(
            user
        );
    }


    /* =========================================================
       SIGNUP FORM
       ========================================================= */

    function setupSignupForm() {

        var form =
            document.getElementById(
                "signupForm"
            );

        if (!form) {
            return;
        }

        /*
         * Prevent duplicate event handlers.
         */

        if (
            form.dataset.authBound ===
            "true"
        ) {
            return;
        }

        form.dataset.authBound =
            "true";


        form.addEventListener(
            "submit",
            async function(event) {

                /*
                 * STOP NORMAL HTML FORM SUBMISSION.
                 *
                 * This is what prevents the page
                 * from reloading.
                 */

                event.preventDefault();

                event.stopPropagation();

                clearMessage();


                var submitButton =
                    document.getElementById(
                        "createAccountButton"
                    );


                setLoading(
                    submitButton,
                    true,
                    "Creating Account..."
                );


                try {

                    /* =========================================
                       ROLE
                       ========================================= */

                    var selectedRole =
                        document.querySelector(
                            'input[name="role"]:checked'
                        );

                    if (!selectedRole) {

                        throw new Error(
                            "Please select your account role."
                        );
                    }

                    var role =
                        selectedRole.value;


                    /* =========================================
                       FORM DATA
                       ========================================= */

                    var formData = {

                        name:
                            getValue(
                                "fullName"
                            ),

                        email:
                            getValue(
                                "email"
                            ),

                        phone:
                            getValue(
                                "phone"
                            ),

                        password:
                            getValue(
                                "password"
                            ),

                        confirmPassword:
                            getValue(
                                "confirmPassword"
                            ),

                        role:
                            role,


                        /* FAMILY */

                        age:
                            getValue(
                                "age"
                            ),

                        bloodGroup:
                            getValue(
                                "bloodGroup"
                            ),

                        gender:
                            getValue(
                                "gender"
                            ),

                        allergies:
                            getValue(
                                "allergies"
                            ),

                        medicalConditions:
                            getValue(
                                "medicalConditions"
                            ),

                        contactName:
                            getValue(
                                "contactName"
                            ),

                        contactRelationship:
                            getValue(
                                "contactRelationship"
                            ),

                        contactPhone:
                            getValue(
                                "contactPhone"
                            ),

                        contactEmail:
                            getValue(
                                "contactEmail"
                            ),

                        medicalConsent:
                            getChecked(
                                "medicalConsent"
                            ),

                        emergencyContactConsent:
                            getChecked(
                                "emergencyContactConsent"
                            ),


                        /* DRIVER */

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


                        /* HOSPITAL */

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


                        /* TERMS */

                        termsAccepted:
                            getChecked(
                                "termsConsent"
                            )
                    };


                    /* =========================================
                       PASSWORD MATCH
                       ========================================= */

                    if (
                        formData.password !==
                        formData.confirmPassword
                    ) {

                        throw new Error(
                            "Passwords do not match."
                        );
                    }


                    /* =========================================
                       IMPORTANT
                       =========================================

                       DO NOT USE:

                       form.checkValidity()

                       here.

                       signup.html contains role-dependent
                       required fields.

                       registerUser() performs validation.
                       ========================================= */


                    /* =========================================
                       REGISTER
                       ========================================= */

                    var result =
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


                    /* =========================================
                       EMAIL CONFIRMATION
                       ========================================= */

                    if (
                        result.needsEmailConfirmation
                    ) {

                        showMessage(
                            result.message ||
                            "Account created successfully. Please verify your email.",
                            "success"
                        );

                        setTimeout(
                            function() {

                                window.location.replace(
                                    AUTH_PAGES.signin
                                );

                            },
                            1500
                        );

                        return;
                    }


                    /* =========================================
                       DIRECT DASHBOARD REDIRECT
                       ========================================= */

                    var redirectPage =
                        result.redirect ||
                        getDashboardForRole(
                            result.role
                        );


                    if (!redirectPage) {

                        throw new Error(
                            "Account created, but the account role could not be determined."
                        );
                    }


                    showMessage(
                        "Account created successfully. Redirecting...",
                        "success"
                    );


                    console.log(
                        "Signup successful."
                    );

                    console.log(
                        "Role:",
                        result.role
                    );

                    console.log(
                        "Redirecting to:",
                        redirectPage
                    );


                    /*
                     * IMPORTANT:
                     * Use location.replace so the browser
                     * does not return to signup.html.
                     */

                    setTimeout(
                        function() {

                            window.location.replace(
                                redirectPage
                            );

                        },
                        500
                    );

                } catch (error) {

                    console.error(
                        "Signup error:",
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
       SIGN IN FORM
       ========================================================= */

    function setupSigninForm() {

        var form =
            document.getElementById(
                "signinForm"
            );

        if (!form) {
            return;
        }

        if (
            form.dataset.authBound ===
            "true"
        ) {
            return;
        }

        form.dataset.authBound =
            "true";


        form.addEventListener(
            "submit",
            async function(event) {

                event.preventDefault();

                event.stopPropagation();

                clearMessage();


                var button =
                    form.querySelector(
                        'button[type="submit"]'
                    );


                setLoading(
                    button,
                    true,
                    "Signing in..."
                );


                try {

                    var email =
                        getValue(
                            "email"
                        );

                    var password =
                        getValue(
                            "password"
                        );


                    var result =
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


                    var redirect =
                        result.redirect ||
                        getDashboardForRole(
                            result.role
                        );


                    if (!redirect) {

                        throw new Error(
                            "Your account role is missing."
                        );
                    }


                    showMessage(
                        "Login successful. Redirecting...",
                        "success"
                    );


                    setTimeout(
                        function() {

                            window.location.replace(
                                redirect
                            );

                        },
                        300
                    );

                } catch (error) {

                    console.error(
                        "Signin error:",
                        error
                    );

                    showMessage(
                        error.message ||
                        "Login failed.",
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
       LOGOUT BUTTONS
       ========================================================= */

    function setupLogoutButtons() {

        var selectors = [
            "#logoutBtn",
            "#logoutButton",
            '[data-action="logout"]'
        ];


        selectors.forEach(
            function(selector) {

                document
                    .querySelectorAll(
                        selector
                    )
                    .forEach(
                        function(button) {

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
                        }
                    );
            }
        );
    }


    /* =========================================================
       PASSWORD RESET
       ========================================================= */

    function setupPasswordResetForm() {

        var form =
            document.getElementById(
                "resetPasswordForm"
            );

        if (!form) {
            return;
        }

        if (
            form.dataset.authBound ===
            "true"
        ) {
            return;
        }

        form.dataset.authBound =
            "true";


        form.addEventListener(
            "submit",
            async function(event) {

                event.preventDefault();

                event.stopPropagation();

                clearMessage();


                var email =
                    getValue(
                        "email"
                    );


                var button =
                    form.querySelector(
                        'button[type="submit"]'
                    );


                setLoading(
                    button,
                    true,
                    "Sending..."
                );


                try {

                    var result =
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
                        "Password reset error:",
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

        var supabase =
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
            async function(
                event,
                session
            ) {

                console.log(
                    "ResQ-Route auth state:",
                    event
                );


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
                            "Role setup error:",
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

            console.log(
                "ResQ-Route authentication initializing..."
            );


            setupAuthStateListener();

            setupSignupForm();

            setupSigninForm();

            setupLogoutButtons();

            setupPasswordResetForm();


            var currentPage =
                getCurrentPage();


            /*
             * Load hospitals only on signup page.
             */

            if (
                currentPage ===
                AUTH_PAGES.signup
            ) {

                await loadHospitalsForSignup();
            }


            /*
             * IMPORTANT:
             * Do NOT redirect from signup.html
             * just because a session exists.
             *
             * Signup itself performs the redirect
             * after successful account creation.
             */

            if (
                currentPage ===
                AUTH_PAGES.signin
            ) {

                await redirectIfAuthenticated();
            }


            /*
             * Protect dashboards.
             */

            if (
                PROTECTED_PAGES.includes(
                    currentPage
                )
            ) {

                await protectDashboard();
            }


            console.log(
                "ResQ-Route authentication initialized."
            );

        } catch (error) {

            console.error(
                "Authentication initialization error:",
                error
            );
        }
    }


    /* =========================================================
       GLOBAL API
       ========================================================= */

    window.resqAuth = {

        registerUser:
            registerUser,

        loginUser:
            loginUser,

        logoutUser:
            logoutUser,

        resetPassword:
            resetPassword,

        getCurrentUser:
            getCurrentUser,

        getUserProfile:
            getUserProfile,

        requireAuth:
            requireAuth,

        protectDashboard:
            protectDashboard,

        redirectUserByRole:
            redirectUserByRole,

        redirectByRole:
            redirectUserByRole,

        getDashboardForRole:
            getDashboardForRole,

        normalizeRole:
            normalizeRole,

        completeRoleSetup:
            completeRoleSetup,

        createDriverRecords:
            createDriverRecords,

        createHospitalRecords:
            createHospitalRecords,

        createFamilyRecords:
            createFamilyRecords,

        loadHospitalsForSignup:
            loadHospitalsForSignup
    };


    /* =========================================================
       START
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

})();