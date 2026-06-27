import { useCallback, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

interface MapPin {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  icon: string;
  layer: string;
  size?: number;
}

interface OsmMapProps {
  pins: MapPin[];
  center: { latitude: number; longitude: number };
  zoom: number;
  onPinPress?: (pinId: string) => void;
  enableClustering?: boolean;
  style?: object;
}

function generateLeafletHtml(
  pins: MapPin[],
  center: { latitude: number; longitude: number },
  zoom: number,
  enableClustering: boolean
): string {
  // Safely serialize pins, filtering any invalid entries
  const validPins = pins.filter(
    (p) => p && typeof p.latitude === 'number' && typeof p.longitude === 'number' && p.id
  );
  const pinsJson = JSON.stringify(validPins);

  const clusterCss = enableClustering ? `
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />` : '';

  const clusterJs = enableClustering
    ? `<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
${clusterCss}
${clusterJs}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  #map { width: 100%; height: 100%; }
  .custom-pin {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 2.5px solid #fff;
    box-shadow: 0 3px 8px rgba(0,0,0,0.25);
    font-size: 14px;
    color: #fff;
    cursor: pointer;
    transition: transform 0.15s ease;
  }
  .custom-pin:hover {
    transform: scale(1.2);
  }
  .leaflet-control-attribution {
    font-size: 9px !important;
    opacity: 0.7;
  }
  .marker-cluster-small {
    background-color: rgba(31, 121, 235, 0.3);
  }
  .marker-cluster-small div {
    background-color: rgba(31, 121, 235, 0.7);
    color: #fff;
    font-weight: 600;
    font-size: 12px;
  }
  .marker-cluster-medium {
    background-color: rgba(255, 107, 53, 0.3);
  }
  .marker-cluster-medium div {
    background-color: rgba(255, 107, 53, 0.7);
    color: #fff;
    font-weight: 600;
    font-size: 12px;
  }
  .marker-cluster-large {
    background-color: rgba(229, 57, 53, 0.3);
  }
  .marker-cluster-large div {
    background-color: rgba(229, 57, 53, 0.7);
    color: #fff;
    font-weight: 600;
    font-size: 13px;
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
  (function() {
    try {
      var map = L.map('map', {
        zoomControl: true,
        attributionControl: true,
      }).setView([${center.latitude}, ${center.longitude}], ${zoom});

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);

      var pins = ${pinsJson};
      var markers = {};
      var useClustering = ${String(enableClustering)} && typeof L.markerClusterGroup === 'function' && pins.length > 20;
      var clusterGroup = null;

      if (useClustering) {
        try {
          clusterGroup = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            disableClusteringAtZoom: 16,
          });
        } catch(e) {
          useClustering = false;
        }
      }

      function getIconSvg(iconName) {
        var icons = {
          'warning': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="white" d="M256 32L20 464h472L256 32zm0 128l144 256H112L256 160zm-16 80v96h32v-96h-32zm0 128v32h32v-32h-32z"/></svg>',
          'bulb': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="white" d="M256 48C141.1 48 48 141.1 48 256s93.1 208 208 208 208-93.1 208-208S370.9 48 256 48zm0 320c-8.8 0-16-7.2-16-16h32c0 8.8-7.2 16-16 16zm80-64H176v-16c0-35.3 28.7-64 64-64V176c0-8.8 7.2-16 16-16s16 7.2 16 16v48c35.3 0 64 28.7 64 64v16z"/></svg>',
          'hardware-chip': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="white" d="M352 128H160v256h192V128zm-32 224H192V160h128v192zM464 232h-32v-72c0-17.7-14.3-32-32-32h-72V96h-32v32h-80V96h-32v32h-72c-17.7 0-32 14.3-32 32v72H48v32h32v80H48v32h32v72c0 17.7 14.3 32 32 32h72v32h32v-32h80v32h32v-32h72c17.7 0 32-14.3 32-32v-72h32v-32h-32v-80h32v-32z"/></svg>',
          'eye': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="white" d="M256 128c-81.4 0-153.6 48.4-192 128 38.4 79.6 110.6 128 192 128s153.6-48.4 192-128c-38.4-79.6-110.6-128-192-128zm0 208c-44.2 0-80-35.8-80-80s35.8-80 80-80 80 35.8 80 80-35.8 80-80 80zm0-128c-26.5 0-48 21.5-48 48s21.5 48 48 48 48-21.5 48-48-21.5-48-48-48z"/></svg>',
          'alert-circle': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="white" d="M256 48C141.1 48 48 141.1 48 256s93.1 208 208 208 208-93.1 208-208S370.9 48 256 48zm-16 104h32v160h-32V152zm16 224c-13.3 0-24-10.7-24-24s10.7-24 24-24 24 10.7 24 24-10.7 24-24 24z"/></svg>',
          'person': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="white" d="M256 256c52.8 0 96-43.2 96-96s-43.2-96-96-96-96 43.2-96 96 43.2 96 96 96zm0 48c-63.6 0-192 32.4-192 96v48h384v-48c0-63.6-128.4-96-192-96z"/></svg>',
          'book': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="white" d="M256 64L128 112v256l128-48 128 48V112L256 64zm-16 48v192l-80 30V142l80-30zm32 0l80 30v192l-80-30V112z"/></svg>',
          'flash': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512"><path fill="white" d="M288 32L128 256h112l-48 224 208-288H288l48-160z"/></svg>',
        };
        return icons[iconName] || icons['warning'];
      }

      for (var i = 0; i < pins.length; i++) {
        var pin = pins[i];
        if (!pin || typeof pin.latitude !== 'number' || typeof pin.longitude !== 'number') continue;

        var size = pin.size || 30;
        var icon = L.divIcon({
          className: '',
          html: '<div class="custom-pin" style="background-color:' + (pin.color || '#1f79eb') + ';width:' + size + 'px;height:' + size + 'px;">' + getIconSvg(pin.icon) + '</div>',
          iconSize: [size, size],
          iconAnchor: [size/2, size/2],
        });

        var marker = L.marker([pin.latitude, pin.longitude], { icon: icon });
        (function(pinId) {
          marker.on('click', function() {
            try {
              window.parent.postMessage(JSON.stringify({ type: 'PIN_PRESS', pinId: pinId }), '*');
            } catch(e) {}
          });
        })(pin.id);

        if (useClustering && clusterGroup) {
          clusterGroup.addLayer(marker);
        } else {
          marker.addTo(map);
        }
        markers[pin.id] = marker;
      }

      if (useClustering && clusterGroup) {
        map.addLayer(clusterGroup);
      }
    } catch(e) {
      console.error('Map initialization error:', e);
    }
  })();
</script>
</body>
</html>`;
}

export default function OsmMap({ pins, center, zoom, onPinPress, enableClustering = false, style }: OsmMapProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const html = useMemo(
    () => generateLeafletHtml(pins || [], center, zoom, enableClustering),
    [pins, center, zoom, enableClustering]
  );

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        if (typeof event.data !== 'string') return;
        const data = JSON.parse(event.data);
        if (data && data.type === 'PIN_PRESS' && data.pinId && onPinPress) {
          onPinPress(data.pinId);
        }
      } catch {
        // Ignore non-JSON messages
      }
    },
    [onPinPress]
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const srcDoc = useMemo(() => html, [html]);

  return (
    <View style={[styles.container, style]}>
      <iframe
        ref={iframeRef as React.RefObject<HTMLIFrameElement>}
        srcDoc={srcDoc}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: 16,
        }}
        title="OpenStreetMap - Bamako"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 16,
  },
});
