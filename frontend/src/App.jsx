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

  return <primitive object={scene} scale={1.6} position={[0, -0.8, 0]} />;
}

function FallbackCube({ color, useCustomColor }) {
  return (
    <mesh rotation={[0.5, 0.5, 0]}>
      <boxGeometry args={[1.8, 1.8, 1.8]} />
      <meshStandardMaterial color={useCustomColor ? color : '#333333'} roughness={0.3} metalness={0.7} />
    </mesh>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('viewer');
  const [assetColor, setAssetColor] = useState('#00ffcc');
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [adminPasscode, setAdminPasscode] = useState(''); 
  const [showPassword, setShowPassword] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Responsive state tracker for handling window resizing
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
    if (!uploadFile) return alert("Please select a 3D file first!");
    if (!adminPasscode) return alert("Admin Passcode is required!");

    setIsUploading(true);
    const formData = new FormData();
    formData.append('title', uploadTitle || 'Untitled Model');
    formData.append('3dFile', uploadFile);

    try {
      await axios.post(`${BACKEND_URL}/api/upload-3d`, formData, {
        headers: { 'x-admin-passcode': adminPasscode }
      });
      alert('Upload Successful!');
      setUploadTitle('');
      setUploadFile(null);
      fetchAssets(); 
      setActiveTab('viewer'); 
    } catch (error) {
      alert(error.response?.data?.error || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const is3DModel = selectedAsset?.filename.endsWith('.glb') || selectedAsset?.filename.endsWith('.gltf');
  const storagePercentage = Math.min(((usedStorageMB / 1024) / STORAGE_LIMIT_GB) * 100, 100);

  // Dynamic Layout Configurations
  const containerStyle = {
    display: 'flex',
    flexDirection: isMobile ? 'column-reverse' : 'row',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#0a0a0c',
    color: '#eaeaea',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden'
  };

  const navStyle = {
    width: isMobile ? '100vw' : '80px',
    height: isMobile ? '60px' : '100vh',
    backgroundColor: '#030305',
    borderRight: isMobile ? 'none' : '1px solid #1a1a24',
    borderTop: isMobile ? '1px solid #1a1a24' : 'none',
    display: 'flex',
    flexDirection: isMobile ? 'row' : 'column',
    justifyContent: isMobile ? 'space-around' : 'flex-start',
    alignItems: 'center',
    paddingTop: isMobile ? '0' : '30px',
    gap: isMobile ? '0' : '35px',
    zIndex: 20
  };

  const panelStyle = {
    width: isMobile ? '100vw' : '340px',
    height: isMobile ? '40vh' : '100vh',
    backgroundColor: '#0d0d14',
    borderRight: isMobile ? 'none' : '1px solid #1a1a24',
    borderBottom: isMobile ? '1px solid #1a1a24' : 'none',
    padding: '24px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    zIndex: 10,
    overflowY: 'auto'
  };

  const canvasContainerStyle = {
    flexGrow: 1,
    height: isMobile ? '60vh' : '100vh',
    position: 'relative',
    backgroundColor: '#0e0e12'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    boxSizing: 'border-box',
    backgroundColor: '#14141f',
    border: '1px solid #2a2a3d',
    color: 'white',
    borderRadius: '6px',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s'
  };

  const primaryButtonStyle = {
    padding: '12px',
    width: '100%',
    cursor: isUploading ? 'not-allowed' : 'pointer',
    backgroundColor: isUploading ? '#2a2a35' : '#00ffcc',
    color: '#000',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '0.9rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    boxShadow: isUploading ? 'none' : '0 4px 14px rgba(0, 255, 204, 0.2)',
    transition: 'all 0.2s'
  };

  return (
    <div style={containerStyle}>
      
      {/* GLOBAL INJECTED STYLE FOR CUSTOM SCROLLBARS */}
      <style>{`
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0d0d14; }
        ::-webkit-scrollbar-thumb { background: #222235; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #33334d; }
      `}</style>
      
      {/* NAVIGATION INTERFACE */}
      <div style={navStyle}>
        {!isMobile && <div style={{ fontWeight: '900', fontSize: '1.4rem', color: '#fff', letterSpacing: '-1px' }}>3D.</div>}
        <button onClick={() => setActiveTab('viewer')} style={{ background: 'none', border: 'none', color: activeTab === 'viewer' ? '#00ffcc' : '#555566', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'color 0.2s' }}>
          <span style={{ fontSize: '1.4rem' }}>👁️</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Viewer</span>
        </button>
        <button onClick={() => setActiveTab('upload')} style={{ background: 'none', border: 'none', color: activeTab === 'upload' ? '#00ffcc' : '#555566', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', transition: 'color 0.2s' }}>
          <span style={{ fontSize: '1.4rem' }}>☁️</span>
          <span style={{ fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Upload</span>
        </button>
      </div>

      {/* PARAMETERS CONTROL PANEL */}
      <div style={panelStyle}>
        {activeTab === 'viewer' && (
          <>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', color: '#fff' }}>Asset Studio</h2>
            
            <div style={{ backgroundColor: '#14141f', padding: '16px', borderRadius: '8px', border: '1px solid #1f1f2e' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: '#8f8fbc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Color Override</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: useCustomColor ? '14px' : '0' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #2a2a3d', position: 'relative' }}>
                  <input type="color" value={assetColor} onChange={handleColorChange} style={{ absolute: 'absolute', top: -5, left: -5, width: '60px', height: '60px', border: 'none', cursor: 'pointer', background: 'none' }} />
                </div>
                <span style={{ fontFamily: 'monospace', color: useCustomColor ? '#00ffcc' : '#555566', fontSize: '0.9rem', fontWeight: '600' }}>
                  {useCustomColor ? assetColor.toUpperCase() : 'ORIGINAL TEXTURES'}
                </span>
              </div>
              {useCustomColor && (
                <button onClick={handleResetColor} style={{ width: '100%', padding: '10px', backgroundColor: '#1e1e2f', color: '#eaeaea', border: '1px solid #2a2a3d', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', transition: 'all 0.2s' }}>
                  Reset to Original
                </button>
              )}
            </div>

            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: '#8f8fbc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Model Repository</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeigh: isMobile ? '150px' : 'none' }}>
                {assets.length === 0 ? (
                  <p style={{ color: '#444455', fontSize: '0.85rem', fontStyle: 'italic' }}>No production models discovered.</p>
                ) : (
                  assets.map((asset) => (
                    <div 
                      key={asset._id} 
                      onClick={() => { setSelectedAsset(asset); handleResetColor(); }}
                      style={{ padding: '14px', backgroundColor: selectedAsset?._id === asset._id ? '#171726' : '#14141f', border: `1px solid ${selectedAsset?._id === asset._id ? '#00ffcc' : '#1f1f2e'}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s ease' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.85rem', color: selectedAsset?._id === asset._id ? '#fff' : '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '75%' }}>{asset.title}</span>
                      <span style={{ fontSize: '0.7rem', color: '#555566', fontWeight: '700', backgroundColor: '#0a0a0f', padding: '4px 8px', borderRadius: '4px' }}>{asset.fileSize ? `${(asset.fileSize / (1024*1024)).toFixed(1)}M` : '0M'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'upload' && (
          <>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', color: '#fff' }}>CMS Deployment</h2>
            <form onSubmit={handleUpload} style={{ backgroundColor: '#14141f', padding: '18px', borderRadius: '8px', border: '1px solid #1f1f2e', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#8f8fbc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Security Access Key</h3>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input type={showPassword ? "text" : "password"} placeholder="Enter Admin Passcode..." value={adminPasscode} onChange={(e) => setAdminPasscode(e.target.value)} style={inputStyle} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', background: 'none', border: 'none', color: '#555566', cursor: 'pointer', fontSize: '1rem' }}>
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid #1f1f2e', margin: '4px 0' }} />

              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#8f8fbc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payload Extraction</h3>
                <input type="text" placeholder="Assign Asset Name..." value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }} />
                <div style={{ border: '1px dashed #2a2a3d', padding: '12px', borderRadius: '6px', backgroundColor: '#0d0d14', textAlign: 'center', cursor: 'pointer', position: 'relative' }}>
                  <span style={{ fontSize: '0.8rem', color: uploadFile ? '#00ffcc' : '#555566', fontWeight: '600' }}>
                    {uploadFile ? uploadFile.name : 'Choose file (.glb)'}
                  </span>
                  <input type="file" accept=".glb,.gltf" onChange={(e) => setUploadFile(e.target.files[0])} style={{ absolute: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', position: 'absolute', cursor: 'pointer' }} />
                </div>
              </div>

              <button type="submit" disabled={isUploading} style={primaryButtonStyle}>
                {isUploading ? 'Syncing Layers...' : 'Deploy Asset'}
              </button>
            </form>
          </>
        )}

        {/* DYNAMIC METADATA DISK USAGE STORAGE MONITOR */}
        <div style={{ marginTop: isMobile ? '0' : 'auto', backgroundColor: '#040406', padding: '16px', borderRadius: '8px', border: '1px solid #14141f' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#8f8fbc', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <span>Cloudinary Volume</span>
            <span style={{ color: '#fff' }}>{usedStorageMB.toFixed(1)} MB / {STORAGE_LIMIT_GB * 1024} MB</span>
          </div>
          <div style={{ height: '5px', backgroundColor: '#14141f', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${storagePercentage}%`, height: '100%', backgroundColor: storagePercentage > 85 ? '#ff4a4a' : '#00ffcc', boxShadow: storagePercentage > 85 ? 'none' : '0 0 8px #00ffcc', transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
          </div>
          <div style={{ fontSize: '0.65rem', color: '#444455', marginTop: '8px', textAlign: 'right', fontWeight: '500' }}>
            {(STORAGE_LIMIT_GB - (usedStorageMB / 1024)).toFixed(2)} GB Net Free Allocation Remainder
          </div>
        </div>
      </div>

      {/* CORE 3D RENDERING GRAPHICS LAYER */}
      <div style={canvasContainerStyle}>
        <Canvas camera={{ position: [0, 0, 4.5], fov: 45 }}>
          <Environment preset="city" />
          <ambientLight intensity={0.6} />
          <Suspense fallback={<FallbackCube color={assetColor} useCustomColor={useCustomColor} />}>
            {is3DModel ? (
              <DynamicModel url={selectedAsset.fileUrl} color={assetColor} useCustomColor={useCustomColor} />
            ) : (
              <FallbackCube color={assetColor} useCustomColor={useCustomColor} />
            )}
          </Suspense>
          <OrbitControls makeDefault autoRotate autoRotateSpeed={0.6} maxDistance={8} minDistance={2} />
        </Canvas>
      </div>
    </div>
  );
}

export default App;