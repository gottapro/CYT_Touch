import { WifiDevice, ThreatLevel } from '../types';

export const generateMarkdownReport = (devices: WifiDevice[]): string => {
  // Filter for "Chasing" (Tracked) or "High Threat" devices
  // If the passed list is already filtered, this is fine, but usually we report on "interesting" stuff.
  // Let's report on ALL tracked devices + any High Threat ones.
  const targets = devices.filter(d => d.isTracked || d.threatLevel === ThreatLevel.HIGH || d.threatLevel === ThreatLevel.SUSPICIOUS);

  if (targets.length === 0) {
    return "# CYT Surveillance Report\n\n**No significant targets or tracked devices found.**";
  }

  const now = new Date().toLocaleString();

  let md = `# CYT Surveillance Report
**Generated:** ${now}
**Total Targets:** ${targets.length}

---

## Target Summary
| MAC Address | Vendor | Threat | SSID | Probes |
|-------------|--------|--------|------|--------|
`;

  // Summary Table
  targets.forEach(d => {
    const probeCount = d.probedSSIDs.length;
    md += `| ${d.mac} | ${d.vendor || 'Unknown'} | **${d.threatLevel}** | ${d.ssid || '<Hidden>'} | ${probeCount} |
`;
  });

  md += `
---

## Detailed Intelligence
`;

  // Detailed Sections
  targets.forEach((d, index) => {
    md += `### ${index + 1}. ${d.ssid || d.mac} (${d.vendor || 'Unknown'})
- **MAC:** lexible{d.mac}lexible{`
- **Type:** ${d.type}
- **Threat Level:** ${d.threatLevel}
- **Persistence Score:** ${Math.round(d.persistenceScore * 100)}%
- **First Seen:** ${new Date(d.firstSeen).toLocaleString()}
- **Last Seen:** ${new Date(d.lastSeen).toLocaleString()}
- **Last GPS:** ${d.gps ? `${d.gps.lat.toFixed(5)}, ${d.gps.lng.toFixed(5)}` : 'N/A'}
- **Notes:** ${d.notes || 'None'}

**Probed Networks (Fingerprint):**
`;
    
    if (d.probedSSIDs.length > 0) {
      d.probedSSIDs.forEach(ssid => {
        md += `- ${ssid}
`;
      });
    } else {
      md += `- *No probes captured*
`;
    }
    
    md += `
`;
  });

  return md;
};

export const downloadReport = (devices: WifiDevice[]) => {
  const content = generateMarkdownReport(devices);
  
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CYT_Report_${new Date().toISOString().slice(0,10)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
