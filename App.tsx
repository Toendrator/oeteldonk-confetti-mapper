
import React, { useState, useEffect, useRef } from 'react';
import { AppMode, Obstacle, SimulationSettings, SimulationStats } from './types';
import Editor from './components/Editor';
import Simulator from './components/Simulator';
import Sidebar from './components/Sidebar';

const STORAGE_KEY = 'oeteldonk_mapper_project';

const App: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>(AppMode.SETUP);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [autoLoop, setAutoLoop] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [clearTrigger, setClearTrigger] = useState(0);

  // Updated defaults: Significantly smaller particles (3px) for realistic look
  const [settings, setSettings] = useState<SimulationSettings>({
    density: 20,            // Higher density for smaller particles
    particleSize: 3,        // Reduced from 8/4 to 3 for realistic scaling
    gravity: 0.25,          
    aeroScale: 0.18,        
    liftMax: 1.5,
    dragMin: 0.1,
    dragMax: 1.2,
    torqueStrength: 3.0,
    rotDamping: 0.05,
    windStrength: 0,
    windNoiseSpeed: 0.005,
    windNoiseScale: 0.003,
    collisionStickiness: 2.0,
    horizontalFriction: 0.95,
    restitution: 0,
    staticThreshold: 20,
    fadeDuration: 3
  });

  const [stats, setStats] = useState<SimulationStats>({
    fps: 0,
    totalParticles: 0,
    activeParticles: 0,
    staticParticles: 0
  });

  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.obstacles) setObstacles(data.obstacles);
        
        // INTELLIGENT MERGE & SANITIZE
        if (data.settings) {
            const loadedSettings = { ...settings, ...data.settings };
            
            // FIX: Sanitize "Gigantic" legacy values from LocalStorage
            // If user has old settings > 10px, force reset to 4px
            if (loadedSettings.particleSize > 10) {
                console.warn("Legacy particle size detected. Auto-correcting to 4px.");
                loadedSettings.particleSize = 4;
            }

            setSettings(loadedSettings);
        }
        
        if (data.imageUrl) setImageUrl(data.imageUrl);
        setLastSaved(new Date());
      } catch (e) {
        console.error("Failed to load project", e);
      }
    }
  }, []); // Run once on mount

  useEffect(() => {
    if (!imageUrl && obstacles.length === 0) return;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = window.setTimeout(() => {
      const data = { obstacles, settings, imageUrl };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setLastSaved(new Date());
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, [obstacles, settings, imageUrl]);

  const saveProjectManually = () => {
    const data = { obstacles, settings, imageUrl };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setLastSaved(new Date());
    alert("Project handmatig opgeslagen!");
  };

  const resetProject = () => {
    if (window.confirm("Weet je zeker dat je alles wilt wissen?")) {
      localStorage.removeItem(STORAGE_KEY);
      setObstacles([]);
      setImageUrl(null);
      setMode(AppMode.SETUP);
      // Hard reset to factory defaults
      setSettings({
        density: 20,
        particleSize: 3,
        gravity: 0.25,
        aeroScale: 0.18,
        liftMax: 1.5,
        dragMin: 0.1,
        dragMax: 1.2,
        torqueStrength: 3.0,
        rotDamping: 0.05,
        windStrength: 0,
        windNoiseSpeed: 0.005,
        windNoiseScale: 0.003,
        collisionStickiness: 2.0,
        horizontalFriction: 0.95,
        restitution: 0,
        staticThreshold: 20,
        fadeDuration: 3
      });
      setLastSaved(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImageUrl(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-white font-sans">
      <Sidebar 
        mode={mode}
        setMode={setMode}
        imageUrl={imageUrl}
        handleImageUpload={handleImageUpload}
        obstacles={obstacles}
        removeObstacle={(id) => setObstacles(obstacles.filter(o => o.id !== id))}
        clearObstacles={() => setObstacles([])}
        settings={settings}
        setSettings={setSettings}
        isRecording={isRecording}
        setIsRecording={setIsRecording}
        autoLoop={autoLoop}
        setAutoLoop={setAutoLoop}
        onSave={saveProjectManually}
        onReset={resetProject}
        onClearConfetti={() => setClearTrigger(t => t + 1)}
        lastSaved={lastSaved}
        stats={stats}
      />

      <main className="relative flex-1 bg-zinc-900 flex items-center justify-center p-4 overflow-hidden">
        {!imageUrl ? (
          <div className="text-center">
            <div className="mb-4 text-6xl animate-bounce">🎭</div>
            <h2 className="text-2xl font-bold mb-2 text-zinc-200">Oeteldonk Confetti Mapper</h2>
            <p className="text-zinc-500 mb-6">Upload een foto van het gebouw om te beginnen.</p>
            <label className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-full font-bold cursor-pointer transition-colors shadow-lg shadow-red-900/50">
              Selecteer Foto
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center border border-zinc-800 rounded-lg overflow-hidden bg-black/50 backdrop-blur-sm">
             {mode === AppMode.SETUP ? (
               <Editor imageUrl={imageUrl} obstacles={obstacles} addObstacle={(o) => setObstacles([...obstacles, o])} removeObstacle={(id) => setObstacles(obstacles.filter(o => o.id !== id))} />
             ) : (
               <Simulator 
                 imageUrl={imageUrl} 
                 obstacles={obstacles} 
                 settings={settings} 
                 isRecording={isRecording} 
                 autoLoop={autoLoop}
                 clearTrigger={clearTrigger}
                 onRecordingComplete={() => setIsRecording(false)}
                 onStatsUpdate={setStats}
               />
             )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
