import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/*
 * 동일한 Server Component 렌더 요청에서 중복되는 인증 검증과
 * 로그인 매니저 조회만 재사용합니다.
 * React.cache는 사용자/요청 간 결과를 저장하지 않으므로
 * 권한 및 계정 상태는 새로운 요청마다 다시 확인합니다.
 */
export const getRequestClaims = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.getClaims();
});

export const getRequestManager = cache(async (userId: string) => {
  const supabase = await createClient();

  return supabase
    .from("managers")
    .select("id,employee_no,name,role,is_active,display_order")
    .eq("auth_user_id", userId)
    .maybeSingle();
});
