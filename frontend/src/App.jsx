import { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF } from '@react-three/drei';
import { io } from 'socket.io-client';
import axios from 'axios';

// ⚠️ PASTE YOUR LIVE BACKEND URL HERE ⚠️
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

  return <primitive object={scene} scale={1.5} position={[0, -1, 0]} />;
}

function FallbackCube({ color, useCustomColor }) {
  return (
    <mesh rotation={[0.5, 0.5, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color={useCustomColor ? color : '#aaaaaa'} roughness={0.2} metalness={0.8} />
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
  const [showPassword, setShowPassword] = useState(false); // Eye button tracking
  const [isUploading, setIsUploading] = useState(false);

  // Storage tracking (Cloudinary Free limit is roughly 25GB)
  const STORAGE_LIMIT_GB = 25;
  const [usedStorageMB, setUsedStorageMB] = useState(0);

  const fetchAssets = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/assets`);
      setAssets(response.data);
      if (response.data.length > 0 && !selectedAsset) {
        setSelectedAsset(response.data[0]);
      }

      const totalBytes = response.data.reduce((acc, curr) => acc + (curr.fileSize || 0), 0);
      const totalMB = totalBytes / (1024 * 1024);
      setUsedStorageMB(totalMB);

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
    if (!uploadFile) {
      alert("Please select a 3D file first!");
      return;
    }
    if (!adminPasscode) {
      alert("Admin Passcode is required to deploy storage changes!");
      return;
    }

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
      console.error(error);
      alert(error.response?.data?.error || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const is3DModel = selectedAsset?.filename.endsWith('.glb') || selectedAsset?.filename.endsWith('.gltf');
  const storagePercentage = Math.min(((usedStorageMB / 1024) / STORAGE_LIMIT_GB) * 100, 100);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#121212', color: '#eaeaea', fontFamily: 'system-ui, sans-serif' }}>
      
      {/* LEFT NAVIGATION */}
      <div style={{ width: '80px', backgroundColor: '#0a0a0a', borderRight: '1px solid #222', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px', gap: '20px', zIndex: 10 }}>
        <div style={{ fontWeight: '900', fontSize: '1.2rem', color: '#fff', marginBottom: '20px' }}>3D.</div>
        <button onClick={() => setActiveTab('viewer')} style={{ background: 'none', border: 'none', color: activeTab === 'viewer' ? '#00ffcc' : '#666', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '1.5rem' }}>👁️</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Viewer</span>
        </button>
        <button onClick={() => setActiveTab('upload')} style={{ background: 'none', border: 'none', color: activeTab === 'upload' ? '#00ffcc' : '#666', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '1.5rem' }}>☁️</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>Upload</span>
        </button>
      </div>

      {/* ACTIVE TAB PANEL */}
      <div style={{ width: '320px', backgroundColor: '#1a1a1a', borderRight: '1px solid #222', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', zIndex: 10, overflowY: 'auto' }}>
        
        {activeTab === 'viewer' && (
          <>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>Asset Viewer</h2>
            <div style={{ backgroundColor: '#252525', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#aaa' }}>Color Override</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <input type="color" value={assetColor} onChange={handleColorChange} style={{ width: '40px', height: '40px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }} />
                <span style={{ fontFamily: 'monospace', color: '#888' }}>
                  {useCustomColor ? assetColor.toUpperCase() : 'Original Textures'}
                </span>
              </div>
              {useCustomColor && (
                <button onClick={handleResetColor} style={{ width: '100%', padding: '8px', backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                  Reset to Original
                </button>
              )}
            </div>
            <div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#aaa' }}>My Models</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {assets.length === 0 ? (
                  <p style={{ color: '#666', fontSize: '0.9rem' }}>No models uploaded yet.</p>
                ) : (
                  assets.map((asset) => (
                    <div 
                      key={asset._id} 
                      onClick={() => { setSelectedAsset(asset); handleResetColor(); }}
                      style={{ padding: '12px', backgroundColor: selectedAsset?._id === asset._id ? '#333' : '#222', border: `1px solid ${selectedAsset?._id === asset._id ? '#00ffcc' : '#333'}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: '0.2s' }}>
                      <span style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '80%' }}>{asset.title}</span>
                      <span style={{ fontSize: '0.7rem', color: '#666' }}>{asset.fileSize ? `${(asset.fileSize / (1024*1024)).toFixed(1)}MB` : '0MB'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'upload' && (
          <>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>Add New Model</h2>
            <form onSubmit={handleUpload} style={{ backgroundColor: '#252525', padding: '16px', borderRadius: '8px', border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#aaa' }}>Admin Gate</h3>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Enter Admin Passcode..." 
                    value={adminPasscode} 
                    onChange={(e) => setAdminPasscode(e.target.value)} 
                    style={{ width: '100%', padding: '10px', paddingRight: '40px', boxSizing: 'border-box', backgroundColor: '#111', border: '1px solid #444', color: 'white', borderRadius: '4px' }} 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.1rem', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              
              <hr style={{ border: '0', borderTop: '1px solid #333', margin: '5px 0' }} />

              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#aaa' }}>Asset Details</h3>
                <input type="text" placeholder="Asset Title..." value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box', backgroundColor: '#111', border: '1px solid #444', color: 'white', borderRadius: '4px' }} />
                <input type="file" accept=".glb,.gltf" onChange={(e) => setUploadFile(e.target.files[0])} style={{ width: '100%', color: '#aaa' }} />
              </div>

              <button type="submit" disabled={isUploading} style={{ padding: '10px', width: '100%', cursor: isUploading ? 'not-allowed' : 'pointer', backgroundColor: isUploading ? '#666' : '#00ffcc', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', marginTop: '5px' }}>
                {isUploading ? 'Uploading...' : 'Upload to Cloud Library'}
              </button>
            </form>
          </>
        )}

        {/* PERSISTENT CAPACITY REMINDER */}
        <div style={{ marginTop: 'auto', backgroundColor: '#0a0a0a', padding: '14px', borderRadius: '8px', border: '1px solid #222' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#aaa', marginBottom: '6px' }}>
            <span>Cloudinary Storage</span>
            <span>{usedStorageMB.toFixed(1)} MB / {STORAGE_LIMIT_GB * 1024} MB</span>
          </div>
          <div style={{ height: '6px', backgroundColor: '#222', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${storagePercentage}%`, height: '100%', backgroundColor: storagePercentage > 85 ? '#ff4a4a' : '#00ffcc', transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize: '0.65rem', color: '#555', marginTop: '6px', textAlign: 'right' }}>
            {(STORAGE_LIMIT_GB - (usedStorageMB / 1024)).toFixed(2)} GB Free Capacity Remaining
          </div>
        </div>

      </div>

      {/* MAIN 3D CANVAS */}
      <div style={{ flexGrow: 1, position: 'relative' }}>
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <Environment preset="city" />
          <ambientLight intensity={0.5} />
          <Suspense fallback={<FallbackCube color={assetColor} useCustomColor={useCustomColor} />}>
            {is3DModel ? (
              <DynamicModel url={selectedAsset.fileUrl} color={assetColor} useCustomColor={useCustomColor} />
            ) : (
              <FallbackCube color={assetColor} useCustomColor={useCustomColor} />
            )}
          </Suspense>
          <OrbitControls makeDefault autoRotate autoRotateSpeed={1} />
        </Canvas>
      </div>
    </div>
  );
}

export default App;