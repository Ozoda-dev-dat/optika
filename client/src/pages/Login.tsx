import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ✅ MUHIM: session cookie uchun
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        // Serverdan aniq xabarni o‘qib olamiz
        let msg = "Login yoki parol noto'g'ri";
        try {
          const data = await response.json();
          if (data?.message) msg = data.message;
        } catch {
          // JSON bo‘lmasa ham mayli
        }
        throw new Error(msg);
      }

      // Login muvaffaqiyatli bo‘lsa
      // cookie set bo‘ladi, keyin /api/user ishlaydi
      window.location.href = "/"; // ✅ reloaddan ko‘ra toza
    } catch (error: any) {
      toast({
        title: "Xatolik",
        description: error?.message || "Noma'lum xatolik",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto flex items-center justify-center shadow-xl shadow-primary/30 text-primary-foreground text-3xl font-bold">
            O
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Optika CRM
          </h1>
          <p className="text-muted-foreground">
            Tizimga kirish uchun login va parolingizni kiriting
          </p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-center">Kirish</CardTitle>
          </CardHeader>
          <CardContent className="pb-8 px-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Login</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Parol</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full py-6 text-lg font-medium"
                disabled={isLoading}
              >
                {isLoading ? "Yuklanmoqda..." : "Kirish"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
