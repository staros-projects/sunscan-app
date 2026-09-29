import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useContext } from 'react';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { Gyroscope } from 'expo-sensors';
import { Asset } from 'expo-asset';
// Namespace import rather than the global expo-three installs as a side effect
import * as THREE from 'three';
import { loadAsync } from 'expo-three';
import AppContext from './AppContext';

const SunSphere = forwardRef((props, ref) => {
  const meshRef = useRef();
  const [rotation, setRotation] = useState({ x: 0, y: -1.6 });
  const [texture, setTexture] = useState(null);

  const targetRotation = useRef({ x: 0, y: -1.6 }); // rotation cible pour l'animation

  const myContext = useContext(AppContext);

  // Load texture.
  //
  // The texture is ours, not react-three-fiber's : it is built here and handed
  // to the material as a prop. r3f disposes the geometry and the material it
  // created from the JSX, and three's Material.dispose() does not touch its
  // maps — so without the cleanup below a full-resolution Sun (tens of MB once
  // uploaded with its mipmaps) would sit on the GPU until the process dies,
  // once per image opened in 3D.
  useEffect(() => {
    let mounted = true;
    let loaded = null;
    (async () => {
      try {
        const base =  `http://${myContext.apiURL}`;
        const url = `${base}/${props.textureUri}`;
        const asset = Asset.fromURI(url);
        await asset.downloadAsync();
        const tex = await loadAsync(asset);
        // Magnification only takes Nearest/Linear : the mipmap filters are
        // minification-only, and three warns and falls back on the others.
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestMipmapNearestFilter;

        tex.generateMipmaps = true;
        tex.needsUpdate = true;
        // Nobody is going to show it : let it go rather than strand it
        if (!mounted) {
          tex.dispose();
          return;
        }
        loaded = tex;
        setTexture(tex);
      } catch (e) {
        console.warn('Texture load failed :', e);
      }
    })();
    return () => {
      mounted = false;
      // Cleared first : the mesh must stop pointing at it before it goes, or
      // three re-uploads the texture it was just told to drop.
      setTexture(null);
      loaded?.dispose();
    };
  }, [props.textureUri]);

  // Gyroscope
  useEffect(() => {
    Gyroscope.setUpdateInterval(200);
    const subscription = Gyroscope.addListener(({ x, y }) => {
      targetRotation.current = {
        x: targetRotation.current.x - y * 0.1,
        y: targetRotation.current.y + x * 0.1 ,
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
