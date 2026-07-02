import { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF } from '@react-three/drei';
import { io } from 'socket.io-client';
import axios from 'axios';

// PASTE YOUR LIVE BACKEND URL HERE 
// Example: 'https://my-3d-backend.onrender.com'
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
  const [isUploading, setIsUploading] = useState(false);

  const fetchAssets = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/assets`);
      setAssets(response.data);
      if (response.data.length > 0 && !selectedAsset) {
        setSelectedAsset(response.data[0]);
      }
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

    setIsUploading(true);
    const formData = new FormData();
    formData.append('title', uploadTitle || 'Untitled Model');
    formData.append('3dFile', uploadFile);

    try {
      await axios.post(`${BACKEND_URL}/api/upload-3d`, formData);
      alert('Upload Successful!');
      setUploadTitle('');
      setUploadFile(null);
      fetchAssets(); 
      setActiveTab('viewer'); 
    } catch (error) {
      console.error(error);
      alert('Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const is3DModel = selectedAsset?.filename.endsWith('.glb') || selectedAsset?.filename.endsWith('.gltf');

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
                      <span style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.title}</span>
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
            <form onSubmit={handleUpload} style={{ backgroundColor: '#252525', padding: '16px', borderRadius: '8px', border: '1px solid #333' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#aaa' }}>Upload Asset (.glb)</h3>
              <input type="text" placeholder="Asset Title..." value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box', backgroundColor: '#111', border: '1px solid #444', color: 'white', borderRadius: '4px' }} />
              <input type="file" accept=".glb,.gltf" onChange={(e) => setUploadFile(e.target.files[0])} style={{ marginBottom: '10px', width: '100%', color: '#aaa' }} />
              <button type="submit" disabled={isUploading} style={{ padding: '10px', width: '100%', cursor: isUploading ? 'not-allowed' : 'pointer', backgroundColor: isUploading ? '#666' : '#00ffcc', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                {isUploading ? 'Uploading...' : 'Upload to Library'}
              </button>
            </form>
          </>
        )}
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