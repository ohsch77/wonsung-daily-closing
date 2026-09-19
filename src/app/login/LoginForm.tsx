"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  BROWSER_SESSION_STORAGE_KEY,
  createClient,
} from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();

  const [employeeNo, setEmployeeNo] =
    useState("");

  const [pin, setPin] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  const handleEmployeeNoChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value
      .toUpperCase()
      .replace(/\s/g, "");

    setEmployeeNo(value);
  };


  const handlePinChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value
      .replace(/\D/g, "")
      .slice(0, 6);

    setPin(value);
  };


  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    setErrorMessage("");

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(
        BROWSER_SESSION_STORAGE_KEY
      );
    }


    const normalizedEmployeeNo =
      employeeNo
        .trim()
        .toUpperCase();


    if (
      !/^A\d+$/.test(
        normalizedEmployeeNo
      )
    ) {
      setErrorMessage(
        "사번을 확인해주세요. 예: A40093"
      );

      return;
    }


    if (!/^\d{6}$/.test(pin)) {
      setErrorMessage(
        "PIN은 숫자 6자리로 입력해주세요."
      );

      return;
    }


    setIsLoading(true);


    try {
      const supabase =
        createClient();


      /*
       * 사용자 화면에서는 사번만 입력
       *
       * 내부적으로 Supabase Auth Email로 변환
       */
      const email =
        `${normalizedEmployeeNo}@BESTSHOP.COM`;


      const {
        data: authData,
        error: authError,
      } =
        await supabase.auth
          .signInWithPassword({
            email,
            password: pin,
          });


      if (
        authError ||
        !authData.user
      ) {
        setErrorMessage(
          "사번 또는 PIN이 올바르지 않습니다."
        );

        return;
      }


      /*
       * Auth 성공 후
       * managers 직원 Master 확인
       */
      const {
        data: manager,
        error: managerError,
      } =
        await supabase
          .from("managers")
          .select(
            `
              id,
              employee_no,
              name,
              role,
              is_active
            `
          )
          .eq(
            "auth_user_id",
            authData.user.id
          )
          .maybeSingle();


      if (
        managerError ||
        !manager
      ) {
        await supabase.auth
          .signOut();

        setErrorMessage(
          "직원정보가 로그인 계정과 연결되어 있지 않습니다."
        );

        return;
      }


      /*
       * 퇴사/사용중지 직원 차단
       */
      if (!manager.is_active) {
        await supabase.auth
          .signOut();

        setErrorMessage(
          "현재 사용이 중지된 직원 계정입니다."
        );

        return;
      }


      /*
       * 입력사번과 Master 사번 재확인
       */
      if (
        manager.employee_no
          .trim()
          .toUpperCase()
        !== normalizedEmployeeNo
      ) {
        await supabase.auth
          .signOut();

        setErrorMessage(
          "로그인 사번과 직원정보가 일치하지 않습니다."
        );

        return;
      }

      window.sessionStorage.setItem(
        BROWSER_SESSION_STORAGE_KEY,
        "active"
      );


      router.replace(
        "/closing-report"
      );

      router.refresh();

    } catch {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(
          BROWSER_SESSION_STORAGE_KEY
        );
      }

      setErrorMessage(
        "로그인 처리 중 오류가 발생했습니다."
      );

    } finally {
      setIsLoading(false);
    }
  };


  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      {/* 사번 */}
      <div>
        <label
          htmlFor="employeeNo"
          className="mb-2 block text-[13px] font-semibold text-[#3A3D43]"
        >
          사번
        </label>

        <input
          id="employeeNo"
          name="employeeNo"
          type="text"
          autoComplete="username"
          autoCapitalize="characters"
          value={employeeNo}
          onChange={
            handleEmployeeNoChange
          }
          placeholder="A40093"
          disabled={isLoading}
          className="h-[54px] w-full rounded-[14px] border border-[#DDE0E5] bg-white px-4 text-[16px] font-semibold uppercase tracking-[0.02em] text-[#1C1E22] transition placeholder:font-normal placeholder:normal-case placeholder:text-[#B0B4BC] focus:border-[#6D7178] focus:outline-none focus:ring-4 focus:ring-black/[0.035] disabled:bg-[#F5F6F7]"
        />
      </div>


      {/* PIN */}
      <div>
        <label
          htmlFor="pin"
          className="mb-2 block text-[13px] font-semibold text-[#3A3D43]"
        >
          PIN
        </label>

        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={
            handlePinChange
          }
          placeholder="6자리 숫자"
          maxLength={6}
          disabled={isLoading}
          className="h-[54px] w-full rounded-[14px] border border-[#DDE0E5] bg-white px-4 text-[18px] font-semibold tracking-[0.2em] text-[#1C1E22] transition placeholder:text-[15px] placeholder:font-normal placeholder:tracking-normal placeholder:text-[#B0B4BC] focus:border-[#6D7178] focus:outline-none focus:ring-4 focus:ring-black/[0.035] disabled:bg-[#F5F6F7]"
        />
      </div>


      {/* Error */}
      {errorMessage && (
        <div className="rounded-[12px] bg-[#FFF3F5] px-4 py-3 text-[13px] font-medium leading-5 text-[#A50034]">
          {errorMessage}
        </div>
      )}


      {/* Login */}
      <button
        type="submit"
        disabled={
          isLoading ||
          employeeNo.length === 0 ||
          pin.length !== 6
        }
        className="h-[56px] w-full rounded-[14px] bg-[#A50034] text-[15px] font-bold text-white transition hover:bg-[#8D002C] disabled:cursor-not-allowed disabled:bg-[#D8DADF] disabled:text-[#999DA5]"
      >
        {isLoading
          ? "로그인 중..."
          : "로그인"}
      </button>
    </form>
  );
}
