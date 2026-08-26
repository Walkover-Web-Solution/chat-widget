import countryCodes from "@/assests/countryCode.json";
import { saveClientDetails } from "@/config/helloApi";
import { addUrlDataHoc } from "@/hoc/addUrlDataHoc";
import { setOpenHelloForm } from "@/store/chat/chatSlice";
import { setHelloClientInfo, setHelloKeysData } from "@/store/hello/helloSlice";
import { GetSessionStorageData } from "@/utils/ChatbotUtility";
import { useCustomSelector } from "@/utils/deepCheckSelector";
import { splitNumber } from "@/utils/utilities";
import { Loader2, Mail, MessageSquare, Phone, Send, User } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useColor } from "./Chatbot/hooks/useColor";
import { useScreenSize } from "./Chatbot/hooks/useScreenSize";

/**
 * A component that displays a form for the user to enter their details.
 * It includes fields for name, email, and phone number, and a submit button.
 */
interface FormComponentProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  chatSessionId: string
}
interface FormData {
  name: string;
  email: string;
  number: string;
  countryCode: string;
}

interface FormErrors {
  name: string;
  email: string;
  number: string;
  countryCode: string;
}

function FormComponent({ chatSessionId }: FormComponentProps) {
  const { foregroundColor, primaryBgColor } = useColor();
  const dispatch = useDispatch();
  const { showWidgetForm, open, userData } = useCustomSelector((state) => {
    const fullScreen = state.Hello?.[chatSessionId]?.helloConfig?.fullScreen;
    return {
      showWidgetForm: state.Hello?.[chatSessionId]?.showWidgetForm ?? true,
      open: state.Chat.openHelloForm,
      userData: state.Hello?.[chatSessionId]?.clientInfo
    };
  });
  const scriptParams = JSON.parse(GetSessionStorageData('helloConfig') || '{}')
  const { isSmallScreen } = useScreenSize();
  const [formData, setFormData] = useState<FormData>({
    name: userData?.Name || "",
    email: userData?.Email || "",
    number: splitNumber(userData?.Phonenumber || "")?.number || "",
    countryCode: splitNumber(userData?.Phonenumber || "")?.code || "+91"
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({
    name: "",
    email: "",
    number: "",
    countryCode: ""
  });

  useEffect(() => {
    setFormData({ ...formData, name: userData?.Name || "", email: userData?.Email || "", number: splitNumber(userData?.Phonenumber || "")?.number || "", countryCode: splitNumber(userData?.Phonenumber || "")?.code || "+91" });
  }, [userData]);

  const setOpen = (open: boolean) => {
    dispatch(setOpenHelloForm(open));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let sanitizedValue = value;
    if (name === "number") {
      sanitizedValue = value.replace(/\D/g, "");
    }
    setFormData({
      ...formData,
      [name]: sanitizedValue
    });
    setErrors({ ...errors, [name]: "" })
  };

  const validate = () => {
    const tempErrors: FormErrors = { name: "", email: "", number: "", countryCode: "" };
    let isValid = true;

    if (!formData.name) {
      tempErrors.name = "Name is required";
      isValid = false;
    } else if (formData.name.length > 26) {
      tempErrors.name = "Name cannot exceed 26 characters";
      isValid = false;
    }

    // Email is optional, but validate if present
    if (formData.email &&
      !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email)
    ) {
      tempErrors.email = "Invalid email address";
      isValid = false;
    }

    // Number is optional, but validate if present
    if (formData.number && !/^\d{10}$/.test(formData.number)) {
      tempErrors.number = "Invalid number";
      isValid = false;
    }

    setErrors(tempErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (validate()) {
      setIsLoading(true);
      let clientData = {
        Name: formData?.name,
        Phonenumber: formData?.number ? `${formData?.countryCode}${formData?.number}` : '',
        Email: formData?.email
      }

      // Dispatch setHelloKeysData if all three fields are filled
      if (formData.name && formData.email && formData.number) {
        dispatch(setHelloKeysData({ showWidgetForm: false }));
      }

      saveClientDetails(clientData).then(() => {
        setOpen(false);
        dispatch(setHelloClientInfo({ clientInfo: { ...clientData } }));
        setIsLoading(false);
      }).catch(() => {
        setIsLoading(false);
      })
    }
  };

  if (!open && !showWidgetForm) return null;
  if (!open && showWidgetForm) return (
    <div className={`mb-2 ${isSmallScreen ? '' : 'mx-auto w-full'}`}>
      <div
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all hover:opacity-95 hover:shadow-md"
        style={{ backgroundColor: primaryBgColor, color: foregroundColor }}
      >
        <div
          className="flex-shrink-0 grid place-items-center w-9 h-9 rounded-lg"
          style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}
        >
          <MessageSquare size={18} />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="font-semibold text-sm truncate">Enter your details</div>
          <div className="text-xs opacity-80 truncate">Click here to provide your information</div>
        </div>
      </div>
    </div>
  );
  return (
    <div
      className={`fixed inset-0 bg-black/50 z-[9999] flex justify-center backdrop-blur-sm animate-fadeIn ${!isSmallScreen ? 'items-center p-4' : 'items-end'}`}
      onClick={() => setOpen(false)}
    >
      <div
        className={`shadow-2xl w-full max-w-md relative dark:border dark:border-gray-500 overflow-y-auto ${!isSmallScreen ? 'rounded-2xl max-h-[90vh] animate-fadeIn' : 'rounded-t-2xl max-h-[92%] animate-slideUp'}`}
        style={{ backgroundColor: 'var(--background)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Card header (sticky); drag handle shown only in bottom-sheet mode */}
        < div className={`bg-primary text-white px-5 py-4 rounded-t-2xl sticky top-0 z-10`} style={{
          background: `linear-gradient(to right, ${primaryBgColor}, ${primaryBgColor}CC)`,
          color: foregroundColor
        }}>
          <h2 className="text-lg font-bold">Enter your details</h2>
          <p className="text-sm opacity-90 mt-1">
            Please provide your information below
          </p>
        </div>

        {/* Form content */}
        <form
          onSubmit={handleSubmit}
          className="p-5 gap-2 flex flex-col"
          style={{ ['--theme-primary' as any]: primaryBgColor }}
        >
          {/* Name field */}
          <div className="form-control w-full">
            <label className="label pt-0">
              <span className="label-text font-medium">Name <span className="text-red-400">*</span></span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <User size={18} />
              </div>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your name"
                disabled={scriptParams?.name ? true : false}
                className={`input input-bordered focus:outline-none focus:ring-1 focus:border-[var(--theme-primary)] focus:ring-[var(--theme-primary)] w-full pl-10 ${errors.name ? "input-error" : ""
                  }`}
                required
              />
            </div>
            {errors.name && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.name}</span>
              </label>
            )}
          </div>

          {/* Email field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text font-medium">Email</span>
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <Mail size={18} />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={scriptParams?.mail || scriptParams?.Email ? true : false}
                placeholder="Enter your email"
                className={`input input-bordered focus:outline-none focus:ring-1 focus:border-[var(--theme-primary)] focus:ring-[var(--theme-primary)] w-full pl-10 ${errors.email ? "input-error" : ""}`}
              />
            </div>
            {errors.email && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.email}</span>
              </label>
            )}
          </div>

          {/* Phone number field */}
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text font-medium">Phone Number</span>
            </label>
            <div className="flex gap-2">
              <div className="relative">
                <select
                  name="countryCode"
                  value={formData.countryCode}
                  onChange={handleChange}
                  className={`select select-bordered focus:outline-none focus:ring-1 focus:border-[var(--theme-primary)] focus:ring-[var(--theme-primary)] select-md max-w-36 pl-10 ${errors.countryCode ? "select-error" : ""}`}
                  style={{ width: 'auto' }}
                >
                  {countryCodes
                    .filter(country => country.dial_code !== null && country.dial_code !== "")
                    .map((country) => (
                      <option key={country.code + country.dial_code} value={String(country.dial_code)}>
                        {country.code} ({country.dial_code})
                      </option>
                    ))}
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                  <Phone size={18} />
                </div>
              </div>
              <div className="relative flex-1">
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  name="number"
                  value={formData.number}
                  onChange={handleChange}
                  disabled={scriptParams?.number || scriptParams?.Phonenumber ? true : false}
                  placeholder="Enter your phone number"
                  className={`input input-bordered focus:outline-none focus:ring-1 focus:border-[var(--theme-primary)] focus:ring-[var(--theme-primary)] w-full ${errors.number ? "input-error" : ""}`}
                />
              </div>
            </div>
            {errors.number && (
              <label className="label">
                <span className="label-text-alt text-error">{errors.number}</span>
              </label>
            )}
          </div>

          {/* Submit button */}
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              className="btn btn-outline flex-1"
              onClick={() => setOpen(false)}
            >
              Skip
            </button>
            <button
              disabled={isLoading}
              type="submit"
              className="btn flex-1"
              style={{
                opacity: isLoading ? 0.5 : 1,
                backgroundColor: primaryBgColor,
                color: foregroundColor
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin mr-2" />
                  Submitting...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Send size={18} className="mr-2" />
                  Submit
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default React.memo(addUrlDataHoc(FormComponent));