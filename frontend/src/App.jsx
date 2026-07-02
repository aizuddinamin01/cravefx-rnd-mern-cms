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

function App() {
  const [activeTab, setActiveTab] = useState('viewer');
  const [assetColor, setAssetColor] = useState('#007AFF'); // Apple Blue default
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [adminPasscode, setAdminPasscode] = useState(''); 
  const [showPassword, setShowPassword] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 850);
  const STORAGE_LIMIT_GB = 25;
  const [usedStorageMB, setUsedStorageMB] = useState(0);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 850);
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

  // Apple Structural Layout Styles
  const containerStyle = {
    position: 'relative',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#000000',
    backgroundImage: 'radial-gradient(circle at 80% 20%, #1c1c1e 0%, #000000 70%)',
    color: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: isMobile ? 'column-reverse' : 'row'
  };

  // Base Liquid Glass Shared Style Block
  const glassPanelStyle = {
    backgroundColor: 'rgba(28, 28, 30, 0.45)',
    backdropFilter: 'blur(30px) saturate(210%)',
    WebkitBackdropFilter: 'blur(30px) saturate(210%)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '24px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    boxSizing: 'border-box'
  };

  const navStyle = {
    ...glassPanelStyle,
    position: 'absolute',
    bottom: isMobile ? '16px' : 'auto',
    left: '16px',
    top: isMobile ? 'auto' : '16px',
    width: isMobile ? 'calc(100vw - 32px)' : '76px',
    height: isMobile ? '64px' : 'calc(100vh - 32px)',
    display: 'flex',
    flexDirection: isMobile ? 'row' : 'column',
    justifyContent: isMobile ? 'space-around' : 'flex-start',
    alignItems: 'center',
    paddingTop: isMobile ? '0' : '40px',
    gap: isMobile ? '0' : '40px',
    zIndex: 30
  };

  const panelStyle = {
    ...glassPanelStyle,
    position: 'absolute',
    left: isMobile ? '16px' : '108px',
    top: isMobile ? 'auto' : '16px',
    bottom: isMobile ? '96px' : '16px',
    width: isMobile ? 'calc(100vw - 32px)' : '340px',
    height: isMobile ? '35vh' : 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    zIndex: 20,
    overflowY: 'auto'
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
    transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
    fontFamily: 'inherit'
  };

  const primaryButtonStyle = {
    padding: '14px',
    width: '100%',
    cursor: isUploading ? 'not-allowed' : 'pointer',
    backgroundColor: isUploading ? 'rgba(255, 255, 255, 0.1)' : '#ffffff',
    color: isUploading ? '#8e8e93' : '#000000',
    border: 'none',
    borderRadius: '14px',
    fontWeight: '600',
    fontSize: '0.9rem',
    letterSpacing: '-0.1px',
    transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)'
  };

  return (
    <div style={containerStyle}>
      
      {/* NATIVE SF SCROLLBAR EMULATION */}
      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
        input[type="text"]:focus, input[type="password"]:focus { border-color: rgba(255, 255, 255, 0.3); background-color: rgba(255, 255, 255, 0.08); }
      `}</style>
      
      {/* FLOATING GLASS NAVIGATION PLATFORM */}
      <div style={navStyle}>
        {!isMobile && <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#ffffff', letterSpacing: '-0.5px', marginBottom: '10px' }}></div>}
        <button onClick={() => setActiveTab('viewer')} style={{ background: 'none', border: 'none', color: activeTab === 'viewer' ? '#ffffff' : 'rgba(255, 255, 255, 0.35)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
          <span style={{ fontSize: '1.3rem' }}>👁️</span>
          <span style={{ fontSize: '0.6rem', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Viewer</span>
        </button>
        <button onClick={() => setActiveTab('upload')} style={{ background: 'none', border: 'none', color: activeTab === 'upload' ? '#ffffff' : 'rgba(255, 255, 255, 0.35)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
          <span style={{ fontSize: '1.3rem' }}>☁️</span>
          <span style={{ fontSize: '0.6rem', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Upload</span>
        </button>
      </div>

      {/* FLOATING LIQUID GLASS CONTROL ENGINE */}
      <div style={panelStyle}>
        {activeTab === 'viewer' && (
          <>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1.4rem', fontWeight: '700', letterSpacing: '-0.4px', color: '#ffffff' }}>Studio</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#8e8e93', fontWeight: '400' }}>Manage and override configurations</p>
            </div>
            
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: '#aeaeeb', letterSpacing: '0.2px', textTransform: 'uppercase', fontWeight: '600' }}>Color Override</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: useCustomColor ? '14px' : '0' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255, 255, 255, 0.2)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', position: 'relative' }}>
                  <input type="color" value={assetColor} onChange={handleColorChange} style={{ absolute: 'absolute', top: -5, left: -5, width: '55px', height: '55px', border: 'none', cursor: 'pointer', background: 'none' }} />
                </div>
                <span style={{ fontFamily: '-apple-system-monospace, monospace', color: useCustomColor ? '#ffffff' : '#8e8e93', fontSize: '0.85rem', fontWeight: '500' }}>
                  {useCustomColor ? assetColor.toUpperCase() : 'NATIVE MAPS'}
                </span>
              </div>
              {useCustomColor && (
                <button onClick={handleResetColor} style={{ width: '100%', padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.06)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '500', transition: 'all 0.2s' }}>
                  Reset to Native
                </button>
              )}
            </div>

            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.75rem', color: '#aeaeeb', letterSpacing: '0.2px', textTransform: 'uppercase', fontWeight: '600' }}>Asset Library</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                {assets.length === 0 ? (
                  <p style={{ color: '#636366', fontSize: '0.85rem', fontStyle: 'italic' }}>Library empty.</p>
                ) : (
                  assets.map((asset) => (
                    <div 
                      key={asset._id} 
                      onClick={() => { setSelectedAsset(asset); handleResetColor(); }}
                      style={{ padding: '14px', backgroundColor: selectedAsset?._id === asset._id ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)', border: '1px solid', borderColor: selectedAsset?._id === asset._id ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)', borderRadius: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s ease' }}>
                      <span style={{ fontWeight: '500', fontSize: '0.85rem', color: selectedAsset?._id === asset._id ? '#ffffff' : '#d1d1d6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '75%' }}>{asset.title}</span>
                      <span style={{ fontSize: '0.7rem', color: '#aeaeb2', backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>{asset.fileSize ? `${(asset.fileSize / (1024*1024)).toFixed(1)}M` : '0M'}</span>
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
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1.4rem', fontWeight: '700', letterSpacing: '-0.4px', color: '#ffffff' }}>Add Asset</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#8e8e93', fontWeight: '400' }}>Deploy layer data securely</p>
            </div>

            <form onSubmit={handleUpload} style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '18px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.04)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#aeaeeb', letterSpacing: '0.2px', textTransform: 'uppercase', fontWeight: '600' }}>Authentication Key</h3>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input type={showPassword ? "text" : "password"} placeholder="Required passcode" value={adminPasscode} onChange={(e) => setAdminPasscode(e.target.value)} style={inputStyle} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.3)', cursor: 'pointer', fontSize: '1rem' }}>
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', margin: '4px 0' }} />

              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#aeaeeb', letterSpacing: '0.2px', textTransform: 'uppercase', fontWeight: '600' }}>Object Parameters</h3>
                <input type="text" placeholder="Assign Asset Name" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} />
                <div style={{ border: '1px dashed rgba(255, 255, 255, 0.15)', padding: '16px', borderRadius: '12px', backgroundColor: 'rgba(0, 0, 0, 0.15)', textAlign: 'center', cursor: 'pointer', position: 'relative', transition: 'border-color 0.2s' }}>
                  <span style={{ fontSize: '0.8rem', color: uploadFile ? '#ffffff' : 'rgba(255, 255, 255, 0.4)', fontWeight: '500' }}>
                    {uploadFile ? uploadFile.name : 'Select binary folder (.glb)'}
                  </span>
                  <input type="file" accept=".glb,.gltf" onChange={(e) => setUploadFile(e.target.files[0])} style={{ absolute: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', position: 'absolute', cursor: 'pointer' }} />
                </div>
              </div>

              <button type="submit" disabled={isUploading} style={primaryButtonStyle}>
                {isUploading ? 'Integrating Data...' : 'Deploy Asset'}
              </button>
            </form>
          </>
        )}

        {/* METADATA SYSTEM ALLOCATION STORAGE DISPLAY */}
        <div style={{ marginTop: 'auto', backgroundColor: 'rgba(0, 0, 0, 0.15)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#8e8e93', fontWeight: '600', marginBottom: '8px', letterSpacing: '0.2px', textTransform: 'uppercase' }}>
            <span>Cloud Allocation</span>
            <span style={{ color: '#ffffff' }}>{usedStorageMB.toFixed(1)} MB / {STORAGE_LIMIT_GB * 1024} MB</span>
          </div>
          <div style={{ height: '4px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${storagePercentage}%`, height: '100%', backgroundColor: storagePercentage > 85 ? '#ff453a' : '#ffffff', transition: 'width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)' }} />
          </div>
          <div style={{ fontSize: '0.65rem', color: '#636366', marginTop: '8px', textAlign: 'right', fontWeight: '500' }}>
            {(STORAGE_LIMIT_GB - (usedStorageMB / 1024)).toFixed(2)} GB Remaining free capacity
          </div>
        </div>
      </div>

      {/* INFINITE BACKGROUND GRAPHICS DISPLAY ENGINE */}
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