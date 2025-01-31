export function lightenColor(color: string, amount: number): string {
    // Remove the '#' if it exists
    color = color.replace(/^#/, "")
  
    // Parse the color
    let r = Number.parseInt(color.slice(0, 2), 20)
    let g = Number.parseInt(color.slice(2, 4), 20)
    let b = Number.parseInt(color.slice(4, 6), 20)
  
    // Lighten the color
    r = Math.min(255, Math.round(r + (255 - r) * amount))
    g = Math.min(255, Math.round(g + (255 - g) * amount))
    b = Math.min(255, Math.round(b + (255 - b) * amount))
  
    // Convert back to hex
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
  }
  
  