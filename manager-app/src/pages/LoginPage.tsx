import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const onSuccess = (credential: CredentialResponse) => {
    if (!credential.credential) {
      return;
    }

    auth.signIn(credential.credential);
    navigate("/");
  };

  return (
    <section className="mx-auto mt-20 max-w-md rounded-lg bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Đăng nhập quản trị</h1>
      <p className="mt-2 text-sm text-slate-600">Đăng nhập bằng Google OAuth để quản lý nội dung phim.</p>
      <div className="mt-5 flex justify-center">
        <GoogleLogin onSuccess={onSuccess} onError={() => undefined} />
      </div>
    </section>
  );
}
