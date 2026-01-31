import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Login() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-in zoom-in-95 duration-500">
        <div className="text-center space-y-2">
           <div className="w-16 h-16 bg-primary rounded-2xl mx-auto flex items-center justify-center shadow-xl shadow-primary/30 text-primary-foreground text-3xl font-bold">
             O
           </div>
           <h1 className="text-3xl font-bold tracking-tight text-foreground">Optika CRM</h1>
           <p className="text-muted-foreground">Tizimga kirish uchun</p>
        </div>

        <Card className="border-0 shadow-2xl">
          <CardContent className="pt-6 pb-8 px-8">
            <Button className="w-full py-6 text-lg font-medium" onClick={() => window.location.href = "/api/login"}>
              Replit orqali kirish
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Xavfsiz avtorizatsiya Replit Auth orqali amalga oshiriladi
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
