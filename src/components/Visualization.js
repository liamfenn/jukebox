import React, { useMemo, useRef } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { Text, Line, Billboard } from '@react-three/drei';
import * as THREE from 'three';

const GenreNode = ({ position, name, isMainGenre }) => {
  const width = isMainGenre ? 3 : 2.5;
  const height = isMainGenre ? 1 : 0.8;

  return (
    <Billboard
      follow={true}
      lockX={false}
      lockY={false}
      lockZ={false}
      position={position}
    >
      {/* Background with border */}
      <mesh>
        <planeGeometry args={[width + 0.1, height + 0.1]} />
        <meshBasicMaterial color="#f0f0f0" />
      </mesh>
      {/* White background */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
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
};

const ArtistNode = ({ position, imageUrl }) => {
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return imageUrl ? loader.load(imageUrl) : null;
  }, [imageUrl]);

  const size = 1.5;

  return (
    <Billboard
      follow={true}
      lockX={false}
      lockY={false}
      lockZ={false}
      position={position}
    >
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial 
          color={imageUrl ? 'white' : '#ffd93d'}
          map={texture}
          transparent={true}
        />
      </mesh>
    </Billboard>
  );
};

const Connection = ({ start, end, type }) => {
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
};

const Visualization = ({ data }) => {
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
};

export default Visualization; 