import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useContext } from 'react';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { Gyroscope } from 'expo-sensors';
import { Asset } from 'expo-asset';
import { TextureLoader } from 'three';
import { loadAsync } from 'expo-three';
import AppContext from './AppContext';

const SunSphere = forwardRef((props, ref) => {
  const meshRef = useRef();
  const [rotation, setRotation] = useState({ x: 0, y: -1.6 });
  const [texture, setTexture] = useState(null);

  const targetRotation = useRef({ x: 0, y: -1.6 }); // rotation cible pour l'animation

  const myContext = useContext(AppContext);

  // Load texture
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const base =  `http://${myContext.apiURL}`;
        const url = `${base}/${props.textureUri}`;
        const asset = Asset.fromURI(url);
        await asset.downloadAsync();
        const tex = await loadAsync(asset);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter; 
        tex.anisotropy = 16;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
        setTexture(tex);
      } catch (e) {
        console.warn('Texture load failed :', e);
      }
    })();
    return () => { mounted = false; };
  }, [props.textureUri]);

  // Gyroscope
  useEffect(() => {
    Gyroscope.setUpdateInterval(25);
    const subscription = Gyroscope.addListener(({ x, y }) => {
      targetRotation.current = {
        x: targetRotation.current.x - y * 0.02,
        y: targetRotation.current.y + x * 0.02 ,
      };
    });
    return () => subscription.remove();
  }, []);

    // Expose resetRotation to parent
    useImperativeHandle(ref, () => ({
      resetRotation: (newX = 0, newY = -1.6) => {
        targetRotation.current = { x: newX, y: newY };
      },
    }));

    // Animate rotation + zoom
    useFrame(() => {
      if (meshRef.current) {
        meshRef.current.rotation.x += (targetRotation.current.x - meshRef.current.rotation.x) * 0.05;
        meshRef.current.rotation.y += (targetRotation.current.y - meshRef.current.rotation.y) * 0.05;
      }
    });

  if (!texture) return null;

  return (

    <mesh ref={meshRef} rotation={[0, -1.3, 0]}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
});

export default SunSphere;
