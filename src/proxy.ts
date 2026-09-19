import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(
  request: NextRequest
) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 아래 정적파일에는 Proxy를 실행하지 않습니다.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};