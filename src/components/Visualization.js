import React, { useMemo, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { Text, Line, Billboard } from '@react-three/drei';
import * as THREE from 'three';

// Pre-create geometries to be reused
const genreGeometry = new THREE.PlaneGeometry(1, 1);
const artistGeometry = new THREE.PlaneGeometry(1, 1);

// Create materials once
const borderMaterial = new THREE.MeshBasicMaterial({ color: '#f0f0f0' });
const whiteMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const fallbackMaterial = new THREE.MeshBasicMaterial({ color: '#ffd93d' });

const GenreNode = React.memo(({ position, name, isMainGenre }) => {
  const width = isMainGenre ? 3 : 2.5;
  const height = isMainGenre ? 1 : 0.8;

  const scale = useMemo(() => [width + 0.1, height + 0.1, 1], [width, height]);
  const innerScale = useMemo(() => [width, height, 1], [width, height]);

  return (
    <Billboard
      follow={true}
      lockX={false}
      lockY={false}
      lockZ={false}
      position={position}
    >
      <mesh geometry={genreGeometry} material={borderMaterial} scale={scale} />
      <mesh geometry={genreGeometry} material={whiteMaterial} scale={innerScale} position={[0, 0, 0.01]} />
      <Text
        position={[0, 0, 0.02]}
        fontSize={isMainGenre ? 0.4 : 0.35}
        color="black"
        anchorX="center"
        anchorY="middle"
        maxWidth={width - 0.2}
      >
        {name}
      </Text>
    </Billboard>
  );
});

const ArtistNode = React.memo(({ position, imageUrl }) => {
  const material = useMemo(() => {
    if (!imageUrl) return fallbackMaterial;
    
    const texture = new THREE.TextureLoader().load(imageUrl);
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true
    });
  }, [imageUrl]);

  const scale = useMemo(() => [1.5, 1.5, 1], []);

  return (
    <Billboard
      follow={true}
      lockX={false}
      lockY={false}
      lockZ={false}
      position={position}
    >
      <mesh geometry={artistGeometry} material={material} scale={scale} />
    </Billboard>
  );
});

const Connection = React.memo(({ start, end, type }) => {
  const points = useMemo(() => [start, end], [start, end]);
  const color = type === 'artist-genre' ? '#ffffff33' : '#ffffff66';

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1}
      dashed={type !== 'artist-genre'}
    />
  );
});

const Visualization = React.memo(({ data }) => {
  const { nodes, connections } = data;

  return (
    <group>
      {connections.map((connection, i) => (
        <Connection key={`connection-${i}`} {...connection} />
      ))}
      {nodes.map((node) => {
        if (node.type === 'genre') {
          return (
            <GenreNode
              key={node.id}
              position={node.position}
              name={node.name}
              isMainGenre={node.isMainGenre}
            />
          );
        } else {
          return (
            <ArtistNode
              key={node.id}
              position={node.position}
              imageUrl={node.imageUrl}
            />
          );
        }
      })}
    </group>
  );
});

export default Visualization; 