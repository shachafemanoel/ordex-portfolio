export function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent">
      <div className="text-center p-8 bg-white dark:bg-[#0f172a] border-[3px] border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(0,85,255,1)]">
        <div className="mb-10">
          <div className="w-24 h-24 mx-auto bg-[#0055ff] border-[3px] border-black flex items-center justify-center -rotate-2 animate-bounce">
            <span className="text-4xl font-black text-white">OX</span>
          </div>
        </div>
        
        <div className="relative mb-6 overflow-hidden border-2 border-black dark:border-white h-4 w-64 mx-auto bg-slate-100 dark:bg-slate-800">
           <div className="absolute inset-y-0 left-0 bg-[#0055ff] animate-[shimmer_2s_infinite] w-full origin-left" style={{ transform: 'translateX(-100%)' }}></div>
        </div>
        
        <p className="text-black dark:text-white font-black uppercase text-xl tracking-tighter">
          בודק הרשאות / <span className="opacity-50">AUTH_CHECK</span>
        </p>
      </div>
      
      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
