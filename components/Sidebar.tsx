
// oeteldonk-confetti-mapper/components/Sidebar.tsx

import React from 'react';
import { AppMode, Obstacle, SimulationSettings, SimulationStats } from '../types';

interface SidebarProps {
  mode: AppMode; setMode: (m: AppMode) => void; imageUrl: string | null;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  obstacles: Obstacle[]; removeObstacle: (id: string) => void; clearObstacles: () => void;
  settings: SimulationSettings; setSettings: (s: SimulationSettings) => void;
  isRecording: boolean; setIsRecording: (r: boolean) => void;
  autoLoop: boolean; setAutoLoop: (l: boolean) => void;
  onSave: () => void; onReset: () => void; onClearConfetti: () => void;
  lastSaved: Date | null; stats: SimulationStats;
}

const Sidebar: React.FC<SidebarProps> = (props) => {
  const { mode, setMode, imageUrl, handleImageUpload, obstacles, removeObstacle, clearObstacles, settings, setSettings, isRecording, setIsRecording, autoLoop, setAutoLoop, onSave, onReset, onClearConfetti, stats } = props;

  const update = (key: keyof SimulationSettings, value: number) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <div className="w-[440px] bg-black border-r border-zinc-800 flex flex-col h-full z-50 text-zinc-300 shadow-2xl font-mono text-[10px] select-none">
      
      {/* 1. HEADER & MODES */}
      <div className="p-2 border-b border-zinc-800 bg-zinc-900/50 flex gap-2 items-center shrink-0">
        <div className="font-black text-white mr-2 tracking-tighter text-xs">OETEL<span className="text-red-600">MAPPER</span></div>
        <div className="flex bg-black rounded p-0.5 border border-zinc-800 flex-1">
            <button onClick={() => setMode(AppMode.SETUP)} className={`flex-1 py-1 rounded font-bold uppercase transition ${mode === AppMode.SETUP ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>1. Setup</button>
            <button disabled={!imageUrl} onClick={() => setMode(AppMode.SIMULATE)} className={`flex-1 py-1 rounded font-bold uppercase transition ${mode === AppMode.SIMULATE ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400 disabled:opacity-20'}`}>2. Sim</button>
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA (Flex-1 ensures it takes available space, overflow-hidden prevents body scroll, child scrolls if needed) */}
      <div className="flex-1 p-2 overflow-hidden flex flex-col min-h-0">
        
        {mode === AppMode.SETUP && (
          <div className="space-y-4 overflow-y-auto pr-1">
             <div className="p-4 border border-dashed border-zinc-800 rounded bg-zinc-900/30 text-center">
                <label className="cursor-pointer block">
                    <span className="block text-zinc-500 mb-2 font-bold">Projectie Afbeelding</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    <div className="bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-6 rounded-full inline-block font-bold transition">Upload Foto</div>
                </label>
             </div>
             
             <div className="border border-zinc-800 rounded bg-black flex-1 flex flex-col min-h-[200px]">
                 <div className="flex justify-between p-2 bg-zinc-900 border-b border-zinc-800 font-bold text-zinc-500 uppercase tracking-wider">
                    <span>Obstakels ({obstacles.length})</span>
                    <button onClick={clearObstacles} className="text-red-500 hover:text-red-400">Wis Alles</button>
                 </div>
                 <div className="overflow-y-auto flex-1 p-1">
                    {obstacles.length === 0 && <div className="p-4 text-center text-zinc-700 italic">Geen obstakels. Teken kaders op de foto.</div>}
                    {obstacles.map((obs, i) => (
                    <div key={obs.id} className="flex justify-between items-center p-2 border-b border-zinc-900 hover:bg-zinc-900/50 rounded">
                        <span className="text-zinc-400">Obstacle #{i+1}</span>
                        <button onClick={() => removeObstacle(obs.id)} className="text-zinc-600 hover:text-red-500 font-bold px-2">×</button>
                    </div>
                    ))}
                 </div>
             </div>
          </div>
        )}

        {mode === AppMode.SIMULATE && (
          <div className="flex flex-col h-full gap-2">
            {/* Monitor Bar */}
            <div className="grid grid-cols-4 gap-1 bg-zinc-900 p-1.5 rounded border border-zinc-800 text-center shrink-0">
                <div><div className="text-[9px] text-zinc-600 uppercase">FPS</div><div className="text-white font-bold">{stats.fps}</div></div>
                <div><div className="text-[9px] text-zinc-600 uppercase">Active</div><div className="text-blue-400 font-bold">{stats.activeParticles}</div></div>
                <div><div className="text-[9px] text-zinc-600 uppercase">Stuck</div><div className="text-yellow-500 font-bold">{stats.staticParticles}</div></div>
                <div><div className="text-[9px] text-zinc-600 uppercase">Total</div><div className="text-zinc-400 font-bold">{stats.totalParticles}</div></div>
            </div>

            {/* SLIDER GRID - SCROLL-LESS */}
            <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-0.5 content-start overflow-hidden">
                
                {/* SECTION: BASICS */}
                <div className="col-span-2 flex items-center gap-2 pt-1 pb-1 border-b border-zinc-900/50 mt-1 mb-1">
                    <div className="w-1 h-2 bg-red-600"></div><span className="font-black uppercase text-zinc-600 tracking-wider">Basis</span>
                </div>
                <SliderWithTooltip label="Aantal/sec" val={settings.density} set={v=>update('density',v)} min={0.1} max={50} step={0.1} 
                    desc="Hoeveel confetti er per seconde wordt gegenereerd." L="Bijna niets" R="Sneeuwstorm" />
                <SliderWithTooltip label="Grootte (px)" val={settings.particleSize} set={v=>update('particleSize',v)} min={1} max={8} step={0.5} unit="px" 
                    desc="De visuele grootte van de snippers." L="Fijn stof" R="Grove snippers" />

                {/* SECTION: PHYSICS */}
                <div className="col-span-2 flex items-center gap-2 pt-2 pb-1 border-b border-zinc-900/50 mt-1 mb-1">
                    <div className="w-1 h-2 bg-white"></div><span className="font-black uppercase text-zinc-600 tracking-wider">Fysica & Aero</span>
                </div>
                
                <SliderWithTooltip label="Zwaartekracht" val={settings.gravity} set={v=>update('gravity',v)} min={0} max={1} step={0.01} 
                    desc="De kracht waarmee deeltjes naar beneden vallen." L="Maan (zwevend)" R="Jupiter (lood)" />
                <SliderWithTooltip label="Luchtweerstand" val={settings.aeroScale} set={v=>update('aeroScale',v)} min={0} max={0.5} step={0.01} 
                    desc="Hoe sterk de lucht de deeltjes afremt en laat dwarrelen." L="Vacuüm (geen effect)" R="Veertje (volledig effect)" />
                
                <SliderWithTooltip label="Swoop (Lift)" val={settings.liftMax} set={v=>update('liftMax',v)} min={0} max={3} step={0.1} 
                    desc="Hoeveel de deeltjes opzij glijden tijdens het vallen (liftkracht)." L="Valt recht naar beneden" R="Zweeft ver weg" />
                <SliderWithTooltip label="Tol Snelheid" val={settings.torqueStrength} set={v=>update('torqueStrength',v)} min={0} max={10} step={0.1} 
                    desc="Hoe snel de snippers om hun as draaien door de luchtstroom." L="Stabiel plat" R="Propeller" />
                
                <SliderWithTooltip label="Rem (Kant)" val={settings.dragMin} set={v=>update('dragMin',v)} min={0} max={0.5} step={0.01} 
                    desc="Weerstand als de confetti met de zijkant door de lucht snijdt." L="Snijdt als een mes" R="Remt af" />
                <SliderWithTooltip label="Rem (Plat)" val={settings.dragMax} set={v=>update('dragMax',v)} min={0} max={2} step={0.01} 
                    desc="Weerstand als de confetti plat tegen de wind in gaat." L="Geen effect" R="Parachute effect" />

                {/* SECTION: WIND */}
                <div className="col-span-2 flex items-center gap-2 pt-2 pb-1 border-b border-zinc-900/50 mt-1 mb-1">
                    <div className="w-1 h-2 bg-blue-500"></div><span className="font-black uppercase text-zinc-600 tracking-wider">Wind</span>
                </div>
                <div className="col-span-2">
                    <SliderWithTooltip label="Basis Richting" val={settings.windStrength} set={v=>update('windStrength',v)} min={-10} max={10} step={0.1} 
                        desc="De constante hoofdwind die op de muur staat." L="Harde storm naar LINKS" R="Harde storm naar RECHTS" />
                </div>
                <SliderWithTooltip label="Turbulentie" val={settings.windNoiseScale} set={v=>update('windNoiseScale',v)} min={0.0001} max={0.01} step={0.0001} 
                    desc="De grootte van de windwervelingen." L="Grote wolken" R="Kleine bubbels" />
                <SliderWithTooltip label="Snelheid" val={settings.windNoiseSpeed} set={v=>update('windNoiseSpeed',v)} min={0} max={0.02} step={0.001} 
                    desc="Hoe snel de windvlagen veranderen in de tijd." L="Bevroren patroon" R="Chaotische storm" />

                {/* SECTION: INTERACTION */}
                <div className="col-span-2 flex items-center gap-2 pt-2 pb-1 border-b border-zinc-900/50 mt-1 mb-1">
                    <div className="w-1 h-2 bg-yellow-500"></div><span className="font-black uppercase text-zinc-600 tracking-wider">Stapel & Plak</span>
                </div>
                <SliderWithTooltip label="Plakkerigheid" val={settings.collisionStickiness} set={v=>update('collisionStickiness',v)} min={0} max={5} step={0.1} 
                    desc="Snelheid waaronder confetti blijft 'plakken' aan obstakels." L="Stuitert weg (elastiek)" R="Plakt direct (lijm)" />
                <SliderWithTooltip label="Stroefheid" val={settings.horizontalFriction} set={v=>update('horizontalFriction',v)} min={0} max={1} step={0.01} 
                    desc="Wrijving tussen confetti onderling. Bepaalt de stapelhoek." L="Glad ijs (glijdt plat)" R="Schuurpapier (hoge hoop)" />
                <div className="col-span-2">
                    <SliderWithTooltip label="Leven (sec)" val={settings.staticThreshold} set={v=>update('staticThreshold',v)} min={1} max={120} step={1} unit="s" 
                        desc="Hoe lang confetti blijft liggen voordat het vervaagt." L="Verdwijnt direct" R="Blijft lang liggen" />
                </div>

            </div>
          </div>
        )}
      </div>

      {/* 3. FOOTER ACTIONS */}
      <div className="p-2 bg-zinc-900 border-t border-zinc-800 space-y-2 shrink-0">
        {mode === AppMode.SIMULATE && (
            <div className="flex gap-2">
                <button 
                    onClick={() => setIsRecording(!isRecording)} 
                    className={`flex-1 py-3 px-2 rounded font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-lg ${isRecording ? 'bg-red-900/30 text-red-500 border border-red-500 animate-pulse' : 'bg-red-600 text-white hover:bg-red-500 hover:shadow-red-900/40'}`}
                >
                    <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500' : 'bg-white'}`}></div>
                    {isRecording ? "Stop Opname" : "Start Opname"}
                </button>
                <button 
                    onClick={() => setAutoLoop(!autoLoop)} 
                    className={`px-3 rounded border border-zinc-700 font-bold text-[10px] uppercase transition ${autoLoop ? 'bg-green-600 border-green-600 text-white' : 'bg-black text-zinc-500 hover:text-white'}`}
                    title="Director Mode Loop (30s)"
                >
                    Loop
                </button>
                 <button onClick={onClearConfetti} className="px-3 rounded bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700 font-bold text-[10px] uppercase" title="Clear All">
                    CLR
                </button>
            </div>
        )}
        <div className="flex justify-between items-center text-[9px] text-zinc-600 font-bold uppercase pt-1 px-1">
            <button onClick={onSave} className="hover:text-zinc-300 transition">Save Project</button>
            <button onClick={onReset} className="hover:text-red-500 transition">Reset All</button>
        </div>
      </div>

    </div>
  );
};

// --- COMPACT SLIDER COMPONENT WITH RICH TOOLTIP ---
const SliderWithTooltip = ({ label, val, set, min, max, step, unit = "", desc, L, R }: any) => {
    return (
        <div className="group relative bg-zinc-900/30 rounded p-1 border border-zinc-800/30 hover:border-zinc-700 hover:bg-zinc-800 transition-all">
            {/* RICH HOVER TOOLTIP */}
            <div className="hidden group-hover:block absolute left-0 bottom-full mb-2 w-56 bg-zinc-950 border border-zinc-700 p-2.5 rounded shadow-2xl z-[100] pointer-events-none">
                <div className="text-white font-bold text-xs mb-1 pb-1 border-b border-zinc-800">{label}</div>
                <div className="text-zinc-400 text-[10px] leading-snug mb-2">{desc}</div>
                <div className="grid grid-cols-2 gap-2 text-[9px]">
                    <div className="border-r border-zinc-800 pr-1">
                        <span className="block text-red-500 font-bold uppercase tracking-wider">Min (Links)</span>
                        <span className="text-zinc-500">{L}</span>
                    </div>
                    <div className="pl-1">
                        <span className="block text-green-500 font-bold uppercase tracking-wider">Max (Rechts)</span>
                        <span className="text-zinc-500">{R}</span>
                    </div>
                </div>
                {/* Arrow */}
                <div className="absolute left-4 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-zinc-950"></div>
                <div className="absolute left-4 top-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-zinc-700 -z-10 translate-y-[1px]"></div>
            </div>

            {/* SLIDER CONTENT */}
            <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] text-zinc-400 font-bold tracking-tight truncate">{label}</span>
                <span className="text-[9px] text-yellow-500 font-mono">{val.toFixed(step < 0.1 ? 2 : 1)}{unit}</span>
            </div>
            <input 
                type="range" className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-600 block hover:accent-red-500"
                min={min} max={max} step={step} value={val} onChange={e => set(parseFloat(e.target.value))} 
            />
        </div>
    )
}

export default Sidebar;
