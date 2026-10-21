import { useState, useEffect } from "react";
import bgImage from "../assets/Capra bg.jpg";
import logo from "../assets/logo.png";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  XCircle,
  X,
  Shield,
  Terminal,
  User,
  Weight,
  Ruler,
  Calendar,
  CreditCard,
  CheckCircle,
  X as XIcon,
  ChevronDown,
} from "lucide-react";
import { buildMemberFullName } from "../utils/memberName";
import { isSupabaseConfigured, supabase } from "../lib/supabase";


const RegisterSkeleton = () => {
  return (
    <div className="w-full max-w-3xl animate-pulse">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-12 h-12 rounded-full bg-zinc-700"></div>
          <div className="h-8 w-40 bg-zinc-700 rounded-lg"></div>
        </div>
        <div className="h-8 w-48 bg-zinc-700 rounded-lg mx-auto mb-2"></div>
        <div className="h-4 w-64 bg-zinc-700 rounded-lg mx-auto"></div>
      </div>

      <div className="bg-soft-gray/5 backdrop-blur-xl border border-classic-gold/20 rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="mb-3">
              <div className="h-4 w-24 bg-zinc-700 rounded mb-1"></div>
              <div className="h-11 w-full bg-zinc-700/50 rounded-xl"></div>
            </div>
          ))}
        </div>

        <div className="h-11 w-full bg-zinc-700 rounded-xl mt-4"></div>

        <div className="mt-5 text-center">
          <div className="h-4 w-48 bg-zinc-700 rounded mx-auto"></div>
        </div>
      </div>
    </div>
  );
};

const getAgeFromBirthDate = (value) => {
  if (!value) return null;
  const birthDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age;
};

function Register() {
  const navigate = useNavigate();
  const latestBirthDate = new Date();
  latestBirthDate.setFullYear(latestBirthDate.getFullYear() - 12);
  const earliestBirthDate = new Date();
  earliestBirthDate.setFullYear(earliestBirthDate.getFullYear() - 120);
  const formatDateInput = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  };
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    middleInitial: "",
    email: "",
    phone: "",
    weight: "",
    height: "",
    date_of_birth: "",
    gender: "Male",
    paymentMethod: "",
    password: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState({});
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [registrationNeedsEmailConfirmation, setRegistrationNeedsEmailConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showSqlPopup, setShowSqlPopup] = useState(false);
  const [sqlDetails, setSqlDetails] = useState({ field: "", attempt: "" });
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [passwordCriteria, setPasswordCriteria] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });


  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const detectSqlInjection = (input) => {
    if (!input) return false;
    const sqlPatterns = [
      /(\bSELECT\b.*\bFROM\b)/i,
      /(\bINSERT\b.*\bINTO\b)/i,
      /(\bUPDATE\b.*\bSET\b)/i,
      /(\bDELETE\b.*\bFROM\b)/i,
      /(\bDROP\b.*\bTABLE\b)/i,
      /(--)/,
      /(;)/,
      /('.*OR.*'.*=.*')/i,
      /(%27)|(')/,
      /(%22)|(")/,
    ];
    for (const pattern of sqlPatterns) {
      if (pattern.test(input)) return true;
    }
    return false;
  };

  const checkPasswordStrength = (password) => {
    setPasswordCriteria({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    });
  };

  const handleInputChange = (field, value) => {
    if (detectSqlInjection(value)) {
      setSqlDetails({ field: field, attempt: value });
      setShowSqlPopup(true);
      return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === "password") checkPasswordStrength(value);
  };

  const validateNamePart = (name, label) => {
    if (!name.trim()) return `${label} is required`;
    if (name.trim().length > 100) return `${label} must be 100 characters or fewer`;
    return "";
  };

  const validateEmail = (email) => {
    if (!email) return "Email is required";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Enter a valid email address";
    return "";
  };

  const validatePhone = (phone) => {
    if (!phone) return "Contact number is required";
    if (!/^09\d{9}$/.test(phone)) {
      return "Enter a valid Philippine mobile number (11 digits, e.g. 09123456789)";
    }
    return "";
  };

  const validateGender = (gender) => {
    if (!gender) return "Gender is required";
    return "";
  };

  const validateWeight = (weight) => {
    if (!weight) return "Weight is required";
    if (isNaN(weight) || weight < 20 || weight > 500) return "Enter a valid weight (20-500 kg)";
    return "";
  };

  const validateHeight = (height) => {
    if (!height) return "Height is required";
    if (isNaN(height) || height < 50 || height > 300) return "Enter a valid height (50-300 cm)";
    return "";
  };

  const validateBirthDate = (birthDate) => {
    if (!birthDate) return "Birthdate is required";
    if (birthDate < formatDateInput(earliestBirthDate) || birthDate > formatDateInput(latestBirthDate)) {
      return "Member must be between 12 and 120 years old";
    }
    return "";
  };

  const validatePaymentMethod = (method) => {
    if (!method) return "Payment method is required";
    return "";
  };

  const validatePassword = (password) => {
    if (!password) return "Password is required";
    if (!passwordCriteria.length) return "Password must be at least 8 characters";
    if (!passwordCriteria.uppercase) return "Password must contain an uppercase letter";
    if (!passwordCriteria.lowercase) return "Password must contain a lowercase letter";
    if (!passwordCriteria.number) return "Password must contain a number";
    if (!passwordCriteria.special) return "Password must contain a special character";
    return "";
  };

  const validateConfirmPassword = (confirmPassword) => {
    if (!confirmPassword) return "Please confirm your password";
    if (confirmPassword !== formData.password) return "Passwords do not match";
    return "";
  };

  const getFieldError = (field) => {
    if (!touched[field]) return "";
    switch (field) {
      case "firstName": return validateNamePart(formData.firstName, "First name");
      case "lastName": return validateNamePart(formData.lastName, "Last name");
      case "middleInitial": return formData.middleInitial.length > 1 ? "Enter one middle initial" : "";
      case "email": return validateEmail(formData.email);
      case "phone": return validatePhone(formData.phone);
      case "weight": return validateWeight(formData.weight);
      case "height": return validateHeight(formData.height);
      case "date_of_birth": return validateBirthDate(formData.date_of_birth);
      case "gender": return validateGender(formData.gender);
      case "paymentMethod": return validatePaymentMethod(formData.paymentMethod);
      case "password": return validatePassword(formData.password);
      case "confirmPassword": return validateConfirmPassword(formData.confirmPassword);
      default: return "";
    }
  };

  const isFormValid = () => {
    return !getFieldError("firstName") &&
      !getFieldError("lastName") &&
      !getFieldError("middleInitial") &&
      !getFieldError("email") &&
      !getFieldError("phone") &&
      !getFieldError("weight") &&
      !getFieldError("height") &&
      !getFieldError("date_of_birth") &&
      !getFieldError("gender") &&
      !getFieldError("paymentMethod") &&
      !getFieldError("password") &&
      !getFieldError("confirmPassword") &&
      formData.firstName && formData.lastName && formData.email && formData.phone && formData.weight &&
      formData.height && formData.date_of_birth && formData.gender && formData.paymentMethod &&
      formData.password && formData.confirmPassword;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const allFields = ["firstName", "lastName", "middleInitial", "email", "phone", "weight", "height", "date_of_birth", "gender", "paymentMethod", "password", "confirmPassword"];
    const newTouched = {};
    allFields.forEach(field => newTouched[field] = true);
    setTouched(newTouched);

    for (const field of allFields) {
      if (detectSqlInjection(formData[field])) {
        setSqlDetails({ field: field, attempt: formData[field] });
        setShowSqlPopup(true);
        return;
      }
    }

    if (isFormValid()) {
      setIsLoading(true);
      setErrorMessage("");

      try {
        if (isSupabaseConfigured && supabase) {
          const firstName = formData.firstName.trim();
          const lastName = formData.lastName.trim();
          const middleInitial = formData.middleInitial.trim();
          const fullName = buildMemberFullName({
            first_name: firstName,
            last_name: lastName,
            middle_initial: middleInitial,
          });
          const { data, error } = await supabase.auth.signUp({
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
            options: {
              emailRedirectTo: `${window.location.origin}/login`,
              data: {
                full_name: fullName,
                registration: {
                  first_name: firstName,
                  last_name: lastName,
                  middle_initial: middleInitial,
                  phone: formData.phone.trim(),
                  weight: String(formData.weight),
                  height: String(formData.height),
                  date_of_birth: formData.date_of_birth,
                  gender: formData.gender,
                  payment_method: formData.paymentMethod,
                },
              },
            },
          });
          if (error) throw error;
          if (!data.user) {
            throw new Error("Registration did not return an account. Please try again.");
          }
          setRegistrationNeedsEmailConfirmation(!data.session);
          setShowSuccessPopup(true);
          return;
        }

        const apiBaseUrl =
          import.meta.env.VITE_API_URL ||
          "/api";

        const response = await fetch(`${apiBaseUrl}/register.php`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
            body: JSON.stringify({
              ...formData,
              full_name: buildMemberFullName({
                first_name: formData.firstName,
                last_name: formData.lastName,
                middle_initial: formData.middleInitial,
              }),
              first_name: formData.firstName.trim(),
              last_name: formData.lastName.trim(),
              middle_initial: formData.middleInitial.trim(),
              role: "member",
            }),
        });

        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
          ? await response.json()
          : {
            success: false,
            message: `Server returned ${response.status} ${response.statusText}. Please check the backend URL and Apache.`,
          };

        if (response.ok && data.success) {
          setRegistrationNeedsEmailConfirmation(false);
          setShowSuccessPopup(true);

        } else {
          setErrorMessage(data.message || "Registration failed. Please try again.");
          setShowErrorPopup(true);
        }
      } catch (error) {
        console.error("Registration error:", error);
        setErrorMessage(
          error?.message
            ? `Unable to reach the registration server: ${error.message}`
            : "Unable to reach the registration server. Please check Apache and the API URL."
        );
        setShowErrorPopup(true);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const closePopup = () => {
    setShowErrorPopup(false);
    setShowSuccessPopup(false);
    setErrorMessage("");
  };

  const closeSqlPopup = () => {
    setShowSqlPopup(false);
    setSqlDetails({ field: "", attempt: "" });
  };


  if (isPageLoading) {
    return (
      <div style={{ position: "relative", minHeight: "100vh" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: "brightness(0.20)",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingLeft: "1rem",
            paddingRight: "1rem",
            paddingTop: "2rem",
            paddingBottom: "2rem",
          }}
        >
          <RegisterSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "brightness(0.20)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: "1rem",
          paddingRight: "1rem",
          paddingTop: "2rem",
          paddingBottom: "2rem",
        }}
      >

        {showSqlPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/90 backdrop-blur-md">
            <div className="max-w-md w-full bg-gradient-to-br from-red-950 to-black border-2 border-red-600 rounded-2xl p-6 shadow-2xl shadow-red-600/40">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-red-600/20 border-2 border-red-600 flex items-center justify-center animate-pulse">
                      <Terminal className="w-7 h-7 text-red-500" />
                    </div>
                    <div className="absolute -top-1 -right-1">
                      <div className="w-4 h-4 bg-red-600 rounded-full animate-ping"></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-red-500">SECURITY ALERT!</h3>
                    <p className="text-xs text-red-400/80">SQL Injection Attempt</p>
                  </div>
                </div>
                <button onClick={closeSqlPopup} className="text-zinc-500 hover:text-red-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mb-4 p-4 bg-black/50 rounded-lg border border-red-500/30">
                <div className="flex items-start gap-2 mb-3">
                  <Shield className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-red-400 text-sm font-mono font-bold">MALICIOUS SQL CODE DETECTED!</p>
                </div>
                <div className="bg-red-950/50 rounded-lg p-3 border border-red-500/20">
                  <p className="text-yellow-500 text-xs font-mono mb-2">Attempt Details:</p>
                  <p className="text-zinc-400 text-xs"><span className="text-red-400">Field:</span> {sqlDetails.field}</p>
                  <p className="text-zinc-400 text-xs mt-1"><span className="text-red-400">Pattern:</span> {sqlDetails.attempt}</p>
                </div>
              </div>
              <button onClick={closeSqlPopup} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg">
                I Understand
              </button>
            </div>
          </div>
        )}


        {showErrorPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
            <div className="max-w-sm w-full bg-red-950/95 border border-red-500/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-red-400">Registration Failed</h3>
                </div>
                <button onClick={closePopup} className="text-zinc-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-zinc-300 text-sm mb-6">{errorMessage}</p>
              <button onClick={closePopup} className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg">
                Try Again
              </button>
            </div>
          </div>
        )}


        {showSuccessPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
            <div className="max-w-sm w-full bg-emerald-950/95 border border-emerald-500/50 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-emerald-400">Registration Successful!</h3>
              </div>
              <div className="text-zinc-300 text-sm mb-6 space-y-2">
                <p>
                  {registrationNeedsEmailConfirmation
                    ? "Your application has been submitted. Check your email and confirm your address to activate your sign-in."
                    : "Your account has been created successfully!"}
                </p>
                <p className="text-yellow-400/80 text-xs">
                  Your account is pending admin approval.
                  You will be able to login once an admin approves your registration.
                </p>
                <p className="text-zinc-500 text-xs mt-2">
                  You will be redirected to the login page.
                </p>
              </div>
              <button
                onClick={() => {
                  closePopup();
                  navigate("/login");
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all"
              >
                Go to Login
              </button>
            </div>
          </div>
        )}


        <div className="w-full max-w-3xl">
          <Link
            to="/"
            aria-label="Back to landing page"
            title="Back to landing page"
            className="group absolute left-6 top-6 z-10 inline-flex h-10 w-14 items-center justify-center rounded-lg border border-classic-gold/20 bg-black/30 text-zinc-300 transition-all hover:-translate-x-0.5 hover:border-classic-gold/60 hover:bg-classic-gold/10 hover:text-classic-gold"
          >
            <ArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" />
          </Link>

          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src={logo} alt="Logo" className="w-12 h-12" />
              <span className="text-3xl font-bold text-gradient">Capra Fitness</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-zinc-400">Join us to start your fitness journey</p>
          </div>

          <div className="bg-soft-gray/5 backdrop-blur-xl border border-classic-gold/20 rounded-2xl p-6">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">

                <div className="md:col-span-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      ["lastName", "Last name", "Dela Cruz"],
                      ["firstName", "First name", "Juan"],
                      ["middleInitial", "Middle initial", "D"],
                    ].map(([field, label, placeholder]) => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-zinc-300 mb-1">{label}</label>
                        <input
                          type="text"
                          value={formData[field]}
                          maxLength={field === "middleInitial" ? 1 : 100}
                          onChange={(e) => handleInputChange(field, field === "middleInitial" ? e.target.value.slice(0, 1).toLocaleUpperCase() : e.target.value)}
                          onBlur={() => setTouched({ ...touched, [field]: true })}
                          className="w-full px-3 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold text-sm"
                          placeholder={placeholder}
                          disabled={isLoading}
                        />
                        {getFieldError(field) && (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {getFieldError(field)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>


                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      onBlur={() => setTouched({ ...touched, email: true })}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold text-sm"
                      placeholder="name@example.com"
                      disabled={isLoading}
                    />
                  </div>
                  {getFieldError("email") && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {getFieldError("email")}
                    </p>
                  )}
                </div>


                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Contact Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={11}
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
                      onBlur={() => setTouched({ ...touched, phone: true })}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold text-sm"
                      placeholder="09123456789"
                      disabled={isLoading}
                    />
                  </div>
                  {getFieldError("phone") && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {getFieldError("phone")}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Weight (kg)</label>
                  <div className="relative">
                    <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="number"
                      value={formData.weight}
                      onChange={(e) => handleInputChange("weight", e.target.value)}
                      onBlur={() => setTouched({ ...touched, weight: true })}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold text-sm"
                      placeholder="70"
                      disabled={isLoading}
                    />
                  </div>
                  {getFieldError("weight") && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {getFieldError("weight")}
                    </p>
                  )}
                </div>


                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Height (cm)</label>
                  <div className="relative">
                    <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="number"
                      value={formData.height}
                      onChange={(e) => handleInputChange("height", e.target.value)}
                      onBlur={() => setTouched({ ...touched, height: true })}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold text-sm"
                      placeholder="170"
                      disabled={isLoading}
                    />
                  </div>
                  {getFieldError("height") && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {getFieldError("height")}
                    </p>
                  )}
                </div>


                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Birthdate</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      min={formatDateInput(earliestBirthDate)}
                      max={formatDateInput(latestBirthDate)}
                      onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
                      onBlur={() => setTouched({ ...touched, date_of_birth: true })}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold text-sm"
                      disabled={isLoading}
                    />
                  </div>
                  {getFieldError("date_of_birth") && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {getFieldError("date_of_birth")}
                    </p>
                  )}
                  {formData.date_of_birth && !getFieldError("date_of_birth") && (
                    <p className="mt-1 text-xs text-zinc-400">
                      Age: {getAgeFromBirthDate(formData.date_of_birth)} years
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Gender</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
                    <select
                      value={formData.gender}
                      onChange={(e) => handleInputChange("gender", e.target.value)}
                      onBlur={() => setTouched({ ...touched, gender: true })}
                      className="w-full pl-10 pr-10 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold appearance-none cursor-pointer text-sm"
                      disabled={isLoading}
                    >
                      <option value="Male" className="bg-zinc-900 text-white">Male</option>
                      <option value="Female" className="bg-zinc-900 text-white">Female</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  </div>
                  {getFieldError("gender") && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {getFieldError("gender")}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Payment Method</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 z-10" />
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) => handleInputChange("paymentMethod", e.target.value)}
                      onBlur={() => setTouched({ ...touched, paymentMethod: true })}
                      className="w-full pl-10 pr-10 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold appearance-none cursor-pointer text-sm"
                      disabled={isLoading}
                    >
                      <option value="" className="bg-zinc-900 text-zinc-400">Select payment method</option>
                      <option value="Cash" className="bg-zinc-900 text-white">Cash</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  </div>
                  {getFieldError("paymentMethod") && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {getFieldError("paymentMethod")}
                    </p>
                  )}
                </div>
                </div>


                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Create Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      onBlur={() => setTouched({ ...touched, password: true })}
                      className="w-full pl-10 pr-12 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold text-sm"
                      placeholder="Create a strong password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4 text-zinc-500" /> : <Eye className="w-4 h-4 text-zinc-500" />}
                    </button>
                  </div>
                  {formData.password && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className={`flex items-center gap-1 ${passwordCriteria.length ? 'text-green-400' : 'text-red-400'}`}>
                          {passwordCriteria.length ? <CheckCircle className="w-3 h-3" /> : <XIcon className="w-3 h-3" />} 8+ chars
                        </span>
                        <span className={`flex items-center gap-1 ${passwordCriteria.uppercase ? 'text-green-400' : 'text-red-400'}`}>
                          {passwordCriteria.uppercase ? <CheckCircle className="w-3 h-3" /> : <XIcon className="w-3 h-3" />} Uppercase
                        </span>
                        <span className={`flex items-center gap-1 ${passwordCriteria.lowercase ? 'text-green-400' : 'text-red-400'}`}>
                          {passwordCriteria.lowercase ? <CheckCircle className="w-3 h-3" /> : <XIcon className="w-3 h-3" />} Lowercase
                        </span>
                        <span className={`flex items-center gap-1 ${passwordCriteria.number ? 'text-green-400' : 'text-red-400'}`}>
                          {passwordCriteria.number ? <CheckCircle className="w-3 h-3" /> : <XIcon className="w-3 h-3" />} Number
                        </span>
                        <span className={`flex items-center gap-1 ${passwordCriteria.special ? 'text-green-400' : 'text-red-400'}`}>
                          {passwordCriteria.special ? <CheckCircle className="w-3 h-3" /> : <XIcon className="w-3 h-3" />} Special
                        </span>
                      </div>
                    </div>
                  )}
                  {getFieldError("password") && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {getFieldError("password")}
                    </p>
                  )}
                </div>


                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                      onBlur={() => setTouched({ ...touched, confirmPassword: true })}
                      className="w-full pl-10 pr-12 py-2.5 bg-zinc-800/50 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-classic-gold text-sm"
                      placeholder="Confirm your password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4 text-zinc-500" /> : <Eye className="w-4 h-4 text-zinc-500" />}
                    </button>
                  </div>
                  {getFieldError("confirmPassword") && (
                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {getFieldError("confirmPassword")}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !isFormValid()}
                className="w-full py-2.5 bg-gradient text-black font-bold rounded-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Register <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="mt-5 text-center">
                <p className="text-zinc-400 text-sm">
                  Already have an account?{" "}
                  <Link to="/login" className="text-classic-gold hover:text-light-gold font-semibold">
                    Login here
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;