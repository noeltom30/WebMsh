const fs = require('fs');
let c = fs.readFileSync('src/pages/ProfilePage.jsx', 'utf8');

c = c.replace(/import \{ getPasswordStrengthScore/g, "import ShapeGrid from '../components/ui/ShapeGrid';\nimport './HomePage.css';\nimport { getPasswordStrengthScore");

c = c.replace(/<div className="min-h-screen bg-slate-950 text-slate-100">/g, 
  '<div className="landing-root relative min-h-screen"><div style={{position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 0, pointerEvents: "none"}}><ShapeGrid animationSpeed={0.5} enableHoverTrails={false} /></div><div className="relative z-10">'
);
c = c.replace(/<\/main>\n      <\/div>/g, '</main>\n      </div>\n    </div>');
c = c.replace(/<\/main>\n    <\/div>/g, '</main>\n      </div>\n    </div>');

// Colors
c = c.replace(/bg-\[linear-gradient\([^\]]+\)\]/g, 'bg-white/35 backdrop-blur-md dark:$&');
c = c.replace(/bg-slate-950\/60/g, 'bg-white/50 dark:bg-slate-950/60');
c = c.replace(/bg-slate-950\/55/g, 'bg-white/50 dark:bg-slate-950/55');
c = c.replace(/bg-slate-900\/60/g, 'bg-white/60 dark:bg-slate-900/60');
c = c.replace(/bg-slate-950\/50/g, 'bg-white/40 dark:bg-slate-950/50');
c = c.replace(/bg-slate-900/g, 'bg-white/70 dark:bg-slate-900');
c = c.replace(/bg-white\/5/g, 'bg-slate-800/5 dark:bg-white/5');
c = c.replace(/bg-cyan-400\/10/g, 'bg-sky-500/10 dark:bg-cyan-400/10');

c = c.replace(/border-slate-500\/40/g, 'border-sky-500/15 dark:border-slate-500/40');
c = c.replace(/border-slate-600\/70/g, 'border-sky-500/20 dark:border-slate-600/70');
c = c.replace(/border-slate-600\/65/g, 'border-sky-500/20 dark:border-slate-600/65');
c = c.replace(/border-slate-600\/75/g, 'border-sky-500/20 dark:border-slate-600/75');
c = c.replace(/border-cyan-300\/30/g, 'border-sky-500/30 dark:border-cyan-300/30');
c = c.replace(/border-white\/10/g, 'border-sky-500/15 dark:border-white/10');

c = c.replace(/text-white/g, 'text-slate-900 dark:text-white');
c = c.replace(/text-slate-100/g, 'text-slate-800 dark:text-slate-100');
c = c.replace(/text-slate-200/g, 'text-slate-700 dark:text-slate-200');
c = c.replace(/text-slate-300/g, 'text-slate-600 dark:text-slate-300');
c = c.replace(/text-slate-400/g, 'text-slate-500 dark:text-slate-400');
c = c.replace(/text-cyan-200/g, 'text-sky-600 dark:text-cyan-200');
c = c.replace(/text-cyan-100/g, 'text-sky-700 dark:text-cyan-100');

fs.writeFileSync('src/pages/ProfilePage.jsx', c);
