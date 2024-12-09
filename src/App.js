import React, { useState, useEffect } from 'react';
import SpotifyWebApi from 'spotify-web-api-js';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Visualization from './components/Visualization';

const CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
const REDIRECT_URI = process.env.NODE_ENV === 'production' 
  ? 'https://jukebox-phi-jade.vercel.app'
  : 'http://localhost:3000';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const spotifyApi = new SpotifyWebApi();

function App() {
  const [visualData, setVisualData] = useState({ nodes: [], connections: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const hash = window.location.hash
      .substring(1)
      .split('&')
      .reduce((initial, item) => {
        const parts = item.split('=');
        initial[parts[0]] = decodeURIComponent(parts[1]);
        return initial;
      }, {});

    window.location.hash = ''; // Clean URL

    if (hash.access_token) {
      setToken(hash.access_token);
      spotifyApi.setAccessToken(hash.access_token);
      setLoading(true);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      
      try {
        const [topArtistsLong, topArtistsMedium, topArtistsShort] = await Promise.all([
          spotifyApi.getMyTopArtists({ limit: 50, time_range: 'long_term' }),
          spotifyApi.getMyTopArtists({ limit: 50, time_range: 'medium_term' }),
          spotifyApi.getMyTopArtists({ limit: 50, time_range: 'short_term' })
        ]).catch(error => {
          console.error('Error fetching top artists:', error);
          return [[], [], []];
        });

        // Get related artists for more connections
        const relatedArtists = await Promise.all(
          [...new Set([
            ...topArtistsLong.items.slice(0, 35),
            ...topArtistsMedium.items.slice(0, 35),
            ...topArtistsShort.items.slice(0, 35)
          ])].map(artist => 
            spotifyApi.getArtistRelatedArtists(artist.id)
              .then(response => response.artists.slice(0, 6))
              .catch(() => [])
          )
        ).then(results => results.flat());

        // Combine and deduplicate artists
        const allArtists = [...new Set([
          ...topArtistsLong.items,
          ...topArtistsMedium.items,
          ...topArtistsShort.items,
          ...relatedArtists
        ])].filter((artist, index, self) => 
          index === self.findIndex(a => a.id === artist.id)
        );

        try {
          // Initialize all data structures
          const nodes = [];
          const connections = [];
          const clusterPositions = [];
          const artistGenreCounts = new Map();
          const genreRelations = new Map();

          // Count how many artists are in each genre and build genre relationships
          allArtists.forEach(artist => {
            artist.genres.forEach(genre1 => {
              artistGenreCounts.set(genre1, (artistGenreCounts.get(genre1) || 0) + 1);
              
              if (!genreRelations.has(genre1)) {
                genreRelations.set(genre1, new Map());
              }
              artist.genres.forEach(genre2 => {
                if (genre1 !== genre2) {
                  const count = genreRelations.get(genre1).get(genre2) || 0;
                  genreRelations.get(genre1).set(genre2, count + 1);
                }
              });
            });
          });

          // Get main genres
          const mainGenres = Array.from(artistGenreCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .filter(([genre, count]) => count >= 3)
            .slice(0, 25)
            .map(([genre]) => genre);

          // Find bridge genres
          const bridgeGenres = Array.from(artistGenreCounts.entries())
            .filter(([genre]) => !mainGenres.includes(genre))
            .filter(([genre, count]) => {
              const connectingArtists = allArtists.filter(artist => 
                artist.genres.includes(genre) && 
                artist.genres.some(g => mainGenres.includes(g))
              ).length;
              return count >= 2 && connectingArtists >= 2;
            })
            .sort((a, b) => {
              const aConnections = allArtists.filter(artist => artist.genres.includes(a[0])).length;
              const bConnections = allArtists.filter(artist => artist.genres.includes(b[0])).length;
              return bConnections - aConnections;
            })
            .slice(0, 40)
            .map(([genre]) => genre);

          // Position main genre clusters with adjusted spacing
          mainGenres.forEach((genre) => {
            const pos = [
              (Math.random() - 0.5) * 65,
              (Math.random() - 0.5) * 40,
              (Math.random() - 0.5) * 65
            ];
            
            while (clusterPositions.some(existing => {
              const dist = Math.sqrt(
                Math.pow(existing.position[0] - pos[0], 2) +
                Math.pow(existing.position[1] - pos[1], 2) +
                Math.pow(existing.position[2] - pos[2], 2)
              );
              return dist < 22;
            })) {
              pos[0] = (Math.random() - 0.5) * 65;
              pos[1] = (Math.random() - 0.5) * 40;
              pos[2] = (Math.random() - 0.5) * 65;
            }
            
            clusterPositions.push({ genre, position: pos, type: 'main' });
            nodes.push({
              id: `genre-${genre}`,
              name: genre,
              type: 'genre',
              position: pos,
              isMainGenre: true
            });
          });

          // Create clusters for organization
          const clusters = new Map();
          mainGenres.forEach(genre => {
            clusters.set(genre, {
              position: clusterPositions.find(p => p.genre === genre).position,
              artists: [],
              subgenres: new Set()
            });
          });

          // Assign artists to primary clusters with more genres per artist
          allArtists.forEach(artist => {
            const artistGenres = artist.genres
              .filter(g => mainGenres.includes(g) || bridgeGenres.includes(g))
              .sort((a, b) => {
                const aCount = artistGenreCounts.get(a) || 0;
                const bCount = artistGenreCounts.get(b) || 0;
                return bCount - aCount;
              })
              .slice(0, 4);

            if (artistGenres.length > 0) {
              const primaryGenre = artistGenres.find(g => mainGenres.includes(g)) || artistGenres[0];
              if (clusters.has(primaryGenre)) {
                clusters.get(primaryGenre).artists.push({
                  id: artist.id,
                  genres: artistGenres
                });
              }
            }
          });

          // Position bridge genres with more spread
          bridgeGenres.forEach(genre => {
            const connectedArtists = allArtists.filter(artist => 
              artist.genres.includes(genre) && 
              artist.genres.some(g => mainGenres.includes(g))
            );

            if (connectedArtists.length >= 2) {
              const mainGenrePositions = connectedArtists
                .flatMap(artist => artist.genres
                  .filter(g => mainGenres.includes(g))
                  .map(g => clusterPositions.find(p => p.genre === g)?.position)
                )
                .filter(pos => pos !== undefined);

              if (mainGenrePositions.length > 0) {
                const centerPos = mainGenrePositions.reduce(
                  (acc, pos) => [acc[0] + pos[0], acc[1] + pos[1], acc[2] + pos[2]],
                  [0, 0, 0]
                ).map(coord => coord / mainGenrePositions.length);

                const bridgePos = [
                  centerPos[0] + (Math.random() - 0.5) * 15,
                  centerPos[1] + (Math.random() - 0.5) * 12,
                  centerPos[2] + (Math.random() - 0.5) * 15
                ];

                clusterPositions.push({ genre, position: bridgePos, type: 'bridge' });
                
                // Add bridge genre node
                nodes.push({
                  id: `genre-${genre}`,
                  name: genre,
                  type: 'genre',
                  position: bridgePos,
                  isMainGenre: false
                });
              }
            }
          });

          // Position artists with adjusted parameters
          clusters.forEach((cluster, mainGenre) => {
            const { position, artists } = cluster;
            
            artists.forEach((artistData, index) => {
              const artist = allArtists.find(a => a.id === artistData.id);
              if (!artist) return;

              const t = index / artists.length;
              const spiralAngle = t * Math.PI * 8;
              const spiralRadius = (5 + Math.random() * 4) * (1 - t * 0.12);
              
              const otherGenrePositions = artistData.genres
                .filter(g => g !== mainGenre)
                .map(g => clusterPositions.find(p => p.genre === g)?.position)
                .filter(pos => pos !== undefined);

              let displacement = [0, 0, 0];
              if (otherGenrePositions.length > 0) {
                const pullCenter = otherGenrePositions.reduce(
                  (acc, pos) => [acc[0] + pos[0], acc[1] + pos[1], acc[2] + pos[2]],
                  [0, 0, 0]
                ).map(coord => coord / otherGenrePositions.length);

                displacement = [
                  (pullCenter[0] - position[0]) * 0.3,
                  (pullCenter[1] - position[1]) * 0.3,
                  (pullCenter[2] - position[2]) * 0.3
                ];
              }

              const artistPos = [
                position[0] + Math.cos(spiralAngle) * spiralRadius + displacement[0] + (Math.random() - 0.5) * 4,
                position[1] + (Math.random() - 0.5) * spiralRadius * 2.2 + displacement[1] + (Math.random() - 0.5) * 4,
                position[2] + Math.sin(spiralAngle) * spiralRadius + displacement[2] + (Math.random() - 0.5) * 4
              ];

              nodes.push({
                id: artist.id,
                name: artist.name,
                type: 'artist',
                position: artistPos,
                imageUrl: artist.images[0]?.url
              });

              // Always connect to primary genre
              connections.push({
                start: artistPos,
                end: position,
                type: 'artist-genre'
              });

              // Connect to other genres if reasonably close
              artistData.genres
                .filter(g => g !== mainGenre)
                .forEach(genre => {
                  const genreNode = nodes.find(n => n.id === `genre-${genre}`);
                  if (genreNode) {
                    const dist = Math.sqrt(
                      Math.pow(artistPos[0] - genreNode.position[0], 2) +
                      Math.pow(artistPos[1] - genreNode.position[1], 2) +
                      Math.pow(artistPos[2] - genreNode.position[2], 2)
                    );
                    
                    if (dist < 35) {
                      connections.push({
                        start: artistPos,
                        end: genreNode.position,
                        type: 'artist-genre'
                      });
                    }
                  }
                });
            });
          });

          setVisualData({ nodes, connections });
        } catch (error) {
          console.error('Error creating visualization:', error);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const login = () => {
    const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=user-top-read`;
    window.location.href = authUrl;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl text-red-500 mb-4">Error: {error}</div>
          <button 
            onClick={login}
            className="px-4 py-2 bg-green-500 rounded hover:bg-green-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!token && !loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <button 
          onClick={login}
          className="px-8 py-4 bg-green-500 rounded-full font-bold text-lg hover:bg-green-600 transition-colors"
        >
          Connect with Spotify
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-2xl">Loading visualization...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-black">
      <Canvas
        camera={{ 
          position: [0, 0, 120],
          fov: 45,
          near: 0.1,
          far: 1000
        }}
        style={{ width: '100%', height: '100vh' }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls 
          enableDamping={true}
          dampingFactor={0.05}
          rotateSpeed={0.5}
          minDistance={50}
          maxDistance={200}
        />
        <Visualization data={visualData} />
      </Canvas>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="text-white">Loading...</div>
        </div>
      )}
    </div>
  );
}

export default App;
