import { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF } from '@react-three/drei';
import { io } from 'socket.io-client';
import axios from 'axios';

const BACKEND_URL = 'https://cravefx-rnd-mern-cms.onrender.com'; 
const socket = io(BACKEND_URL);

function DynamicModel({ url, color, useCustomColor }) {
  const { scene } = useGLTF(url);
  
  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh && child.material) {
          if (!child.userData.originalColorSaved) {
            child.userData.originalColor = child.material.color.clone();
            child.userData.originalColorSaved = true;
          }
          if (useCustomColor) {
            child.material.color.set(color); 
          } else {
            child.material.color.copy(child.userData.originalColor);
          }
        }
      });
    }
  }, [color, useCustomColor, scene]);

  return <primitive object={scene} scale={1.6} position={[0, -0.6, 0]} />;
}

function FallbackCube({ color, useCustomColor }) {
  return (
    <mesh rotation={[0.5, 0.5, 0]}>
      <boxGeometry args={[1.8, 1.8, 1.8]} />
      <meshStandardMaterial color={useCustomColor ? color : '#e5e5ea'} roughness={0.1} metalness={0.1} />
    </mesh>
  );
}

// --- MINIMAL SVG ICONS (Emulating SF Symbols) ---
const ViewerIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#ffffff" : "rgba(255, 255, 255, 0.35)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const UploadIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#ffffff" : "rgba(255, 255, 255, 0.35)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const ToggleUiIcon = ({ isOpen }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s' }}>
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

function App() {
  const [activeTab, setActiveTab] = useState('viewer');
  const [assetColor, setAssetColor] = useState('#007AFF'); 
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [adminPasscode, setAdminPasscode] = useState(''); 
  const [showPassword, setShowPassword] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Layout states
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 850);
  const [isUiOpen, setIsUiOpen] = useState(true); // Control menu visibility for mobile collapse
  
  const STORAGE_LIMIT_GB = 25;
  const [usedStorageMB, setUsedStorageMB] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      const mobileCheck = window.innerWidth <= 850;
      setIsMobile(mobileCheck);
      if (!mobileCheck) setIsUiOpen(true); // Auto-open if resizing back to desktop
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchAssets = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/assets`);
      setAssets(response.data);
      if (response.data.length > 0 && !selectedAsset) {
        setSelectedAsset(response.data[0]);
      }
      const totalBytes = response.data.reduce((acc, curr) => acc + (curr.fileSize || 0), 0);
      setUsedStorageMB(totalBytes / (1024 * 1024));
    } catch (error) {
      console.error('Error fetching assets:', error);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  useEffect(() => {
    socket.on('updateColor', (data) => {
      setAssetColor(data.color);
      setUseCustomColor(data.useCustomColor);
    });
    return () => socket.off('updateColor');
  }, []);

  const handleColorChange = (e) => {
    const newColor = e.target.value;
    setAssetColor(newColor);
    setUseCustomColor(true);
    socket.emit('changeColor', { color: newColor, useCustomColor: true });
  };

  const handleResetColor = () => {
    setUseCustomColor(false);
    socket.emit('changeColor', { color: assetColor, useCustomColor: false });
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return alert("Please select a 3D file.");
    if (!adminPasscode) return alert("Admin Passcode is required.");

    setIsUploading(true);
    const formData = new FormData();
    formData.append('title', uploadTitle || 'Untitled Asset');
    formData.append('3dFile', uploadFile);

    try {
      await axios.post(`${BACKEND_URL}/api/upload-3d`, formData, {
        headers: { 'x-admin-passcode': adminPasscode }
      });
      alert('Asset integrated successfully.');
      setUploadTitle('');
      setUploadFile(null);
      fetchAssets(); 
      setActiveTab('viewer'); 
    } catch (error) {
      alert(error.response?.data?.error || 'Integration failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const is3DModel = selectedAsset?.filename.endsWith('.glb') || selectedAsset?.filename.endsWith('.gltf');
  const storagePercentage = Math.min(((usedStorageMB / 1024) / STORAGE_LIMIT_GB) * 100, 100);

  // --- APPLE STYLE DEFINITIONS ---
  const containerStyle = {
    position: 'relative',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#000000',
    backgroundImage: 'radial-gradient(circle at 50% 30%, #1c1c1e 0%, #000000 85%)',
    color: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
    overflow: 'hidden'
  };

  const glassStyle = {
    backgroundColor: 'rgba(30, 30, 35, 0.45)',
    backdropFilter: 'blur(30px) saturate(210%)',
    WebkitBackdropFilter: 'blur(30px) saturate(210%)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
  };

  const navStyle = {
    ...glassStyle,
    position: 'absolute',
    borderRadius: isMobile ? '20px 20px 0 0' : '24px',
    bottom: isMobile ? '0' : '16px',
    left: isMobile ? '0' : '16px',
    top: isMobile ? 'auto' : '16px',
    width: isMobile ? '100vw' : '76px',
    height: isMobile ? '64px' : 'calc(100vh - 32px)',
    display: 'flex',
    flexDirection: isMobile ? 'row' : 'column',
    justifyContent: isMobile ? 'space-around' : 'flex-start',
    alignItems: 'center',
    paddingTop: isMobile ? '0' : '40px',
    gap: isMobile ? '0' : '40px',
    zIndex: 30,
    boxSizing: 'border-box'
  };

  const panelStyle = {
    ...glassStyle,
    position: 'absolute',
    borderRadius: '24px',
    left: isMobile ? '16px' : '108px',
    right: isMobile ? '16px' : 'auto',
    top: isMobile ? 'auto' : '16px',
    bottom: isMobile ? '80px' : '16px',
    width: isMobile ? 'auto' : '340px',
    height: isMobile ? '38vh' : 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    zIndex: 20,
    overflowY: 'auto',
    boxSizing: 'border-box',
    // Dynamic structural transformation hooks for mobile collapsibility
    transform: isMobile && !isUiOpen ? 'translateY(calc(100% + 100px))' : 'translateY(0)',
    opacity: isMobile && !isUiOpen ? 0 : 1,
    transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    boxSizing: 'border-box',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
    borderRadius: '12px',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  };

  return (
    <div style={containerStyle}>
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
        input[type="text"]:focus, input[type="password"]:focus { border-color: rgba(255, 255, 255, 0.3); background-color: rgba(255, 255, 255, 0.08); }
      `}</style>
      
      {/* --- FLOATING NAVIGATION PLATFORM --- */}
      <div style={navStyle}>
        <div style={{ fontWeight: '700', fontSize: '1.05rem', color: '#ffffff', letterSpacing: '-0.3px', fontFamily: 'monospace' }}>3D.</div>
        <button onClick={() => setActiveTab('viewer')} style={{ background: 'none', border: 'none', color: activeTab === 'viewer' ? '#ffffff' : 'rgba(255, 255, 255, 0.35)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <ViewerIcon active={activeTab === 'viewer'} />
          <span style={{ fontSize: '0.6rem', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Viewer</span>
        </button>
        <button onClick={() => setActiveTab('upload')} style={{ background: 'none', border: 'none', color: activeTab === 'upload' ? '#ffffff' : 'rgba(255, 255, 255, 0.35)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <UploadIcon active={activeTab === 'upload'} />
          <span style={{ fontSize: '0.6rem', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Upload</span>
        </button>
      </div>

      {/* --- MOBILE UI COLLAPSE TOGGLE TRIGGER --- */}
      {isMobile && (
        <button 
          onClick={() => setIsUiOpen(!isUiOpen)}
          style={{ ...glassStyle, position: 'absolute', bottom: '80px', right: '16px', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 25, cursor: 'pointer', outline: 'none' }}
        >
          <ToggleUiIcon isOpen={isUiOpen} />
        </button>
      )}

      {/* --- FLOATING CONTROL PANEL ENGINE --- */}
      <div style={panelStyle}>
        {activeTab === 'viewer' && (
          <>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1.3rem', fontWeight: '700', letterSpacing: '-0.4px' }}>Studio</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#8e8e93' }}>Manage structural assets</p>
            </div>
            
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: '#aeaeb2', letterSpacing: '0.2px', textTransform: 'uppercase', fontWeight: '600' }}>Color Override</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: useCustomColor ? '14px' : '0' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255, 255, 255, 0.2)', position: 'relative' }}>
                  <input type="color" value={assetColor} onChange={handleColorChange} style={{ position: 'absolute', top: -5, left: -5, width: '55px', height: '55px', border: 'none', cursor: 'pointer', background: 'none' }} />
                </div>
                <span style={{ fontFamily: 'monospace', color: useCustomColor ? '#ffffff' : '#8e8e93', fontSize: '0.85rem', fontWeight: '500' }}>
                  {useCustomColor ? assetColor.toUpperCase() : 'NATIVE MAPS'}
                </span>
              </div>
              {useCustomColor && (
                <button onClick={handleResetColor} style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.06)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500' }}>
                  Reset to Native
                </button>
              )}
            </div>

            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: '#aeaeb2', letterSpacing: '0.2px', textTransform: 'uppercase', fontWeight: '600' }}>Asset Library</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                {assets.length === 0 ? (
                  <p style={{ color: '#636366', fontSize: '0.85rem', fontStyle: 'italic' }}>Library empty.</p>
                ) : (
                  assets.map((asset) => (
                    <div 
                      key={asset._id} 
                      onClick={() => { setSelectedAsset(asset); handleResetColor(); }}
                      style={{ padding: '12px 14px', backgroundColor: selectedAsset?._id === asset._id ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)', border: '1px solid', borderColor: selectedAsset?._id === asset._id ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)', borderRadius: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }}>
                      <span style={{ fontWeight: '500', fontSize: '0.85rem', color: selectedAsset?._id === asset._id ? '#ffffff' : '#d1d1d6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '75%' }}>{asset.title}</span>
                      <span style={{ fontSize: '0.7rem', color: '#aeaeb2', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '8px' }}>{asset.fileSize ? `${(asset.fileSize / (1024*1024)).toFixed(1)}M` : '0M'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'upload' && (
          <>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1.3rem', fontWeight: '700', letterSpacing: '-0.4px' }}>Add Asset</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#8e8e93' }}>Deploy layer data safely</p>
            </div>

            <form onSubmit={handleUpload} style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.04)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#aeaeb2', letterSpacing: '0.2px', textTransform: 'uppercase', fontWeight: '600' }}>Access Key</h3>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input type={showPassword ? "text" : "password"} placeholder="Required passcode" value={adminPasscode} onChange={(e) => setAdminPasscode(e.target.value)} style={inputStyle} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', margin: '4px 0' }} />

              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#aeaeb2', letterSpacing: '0.2px', textTransform: 'uppercase', fontWeight: '600' }}>Parameters</h3>
                <input type="text" placeholder="Assign Asset Name" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} />
                <div style={{ border: '1px dashed rgba(255, 255, 255, 0.15)', padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(0, 0, 0, 0.15)', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                  <span style={{ fontSize: '0.8rem', color: uploadFile ? '#ffffff' : 'rgba(255, 255, 255, 0.4)', fontWeight: '500' }}>
                    {uploadFile ? uploadFile.name : 'Select local .glb binary'}
                  </span>
                  <input type="file" accept=".glb,.gltf" onChange={(e) => setUploadFile(e.target.files[0])} style={{ absolute: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', position: 'absolute', cursor: 'pointer' }} />
                </div>
              </div>

              <button type="submit" disabled={isUploading} style={{ padding: '14px', width: '100%', cursor: isUploading ? 'not-allowed' : 'pointer', backgroundColor: isUploading ? 'rgba(255, 255, 255, 0.1)' : '#ffffff', color: isUploading ? '#8e8e93' : '#000000', border: 'none', borderRadius: '12px', fontWeight: '600', fontSize: '0.9rem' }}>
                {isUploading ? 'Integrating...' : 'Deploy Asset'}
              </button>
            </form>
          </>
        )}

        {/* --- CAPACITY TRACKER BAR --- */}
        <div style={{ marginTop: 'auto', backgroundColor: 'rgba(0, 0, 0, 0.15)', padding: '14px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#8e8e93', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>
            <span>Allocation</span>
            <span style={{ color: '#ffffff' }}>{usedStorageMB.toFixed(1)} MB / {STORAGE_LIMIT_GB * 1024} MB</span>
          </div>
          <div style={{ height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${storagePercentage}%`, height: '100%', backgroundColor: storagePercentage > 85 ? '#ff453a' : '#ffffff', transition: 'width 0.4s' }} />
          </div>
        </div>
      </div>

      {/* --- FULLSCREEN GRAPHICS RENDERING CANVAS LAYER --- */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1 }}>
        <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }}>
          <Environment preset="studio" intensity={0.8} />
          <ambientLight intensity={0.7} />
          <Suspense fallback={<FallbackCube color={assetColor} useCustomColor={useCustomColor} />}>
            {is3DModel ? (
              <DynamicModel url={selectedAsset.fileUrl} color={assetColor} useCustomColor={useCustomColor} />
            ) : (
              <FallbackCube color={assetColor} useCustomColor={useCustomColor} />
            )}
          </Suspense>
          <OrbitControls makeDefault autoRotate autoRotateSpeed={0.4} maxDistance={6} minDistance={1.8} />
        </Canvas>
      </div>
    </div>
  );
}

export default App;