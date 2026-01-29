import React, { useEffect, useRef } from "react";
import L from "leaflet";

export function MapPreview(props: { lat?: number; lng?: number; timestamp?: string; address?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const popupRef = useRef<L.Popup | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (mapRef.current) return;

    const map = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView([0, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    mapRef.current = map;
    markerRef.current = L.marker([0, 0]).addTo(map);
    popupRef.current = L.popup();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    const popup = popupRef.current;
    if (!map || !marker || !popup) return;
    if (typeof props.lat !== "number" || typeof props.lng !== "number") {
      map.setView([0, 0], 2);
      marker.setLatLng([0, 0]);
      marker.unbindPopup();
      return;
    }
    const ll: [number, number] = [props.lat, props.lng];
    marker.setLatLng(ll);
    map.setView(ll, 15);
    
    // Update popup content
    let popupContent = `<div style="font-size: 12px;"><b>Location</b><br/>${props.lat.toFixed(6)}, ${props.lng.toFixed(6)}`;
    if (props.timestamp) {
      const date = new Date(props.timestamp);
      popupContent += `<br/><small>${date.toLocaleString()}</small>`;
    }
    if (props.address) {
      popupContent += `<br/><small><i>${props.address}</i></small>`;
    }
    popupContent += `</div>`;
    
    popup.setContent(popupContent);
    marker.bindPopup(popup).openPopup();
  }, [props.lat, props.lng, props.timestamp, props.address]);

  return <div ref={ref} style={{ height: 320, width: "100%", borderRadius: 10, overflow: "hidden", border: "1px solid #eee" }} />;
}


