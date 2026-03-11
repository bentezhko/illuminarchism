function getInvertedColor(hex, alpha) {
    if (!hex) return 'rgba(255, 215, 0, 0.8)'; // Fallback

    let r, g, b;
    if (hex.startsWith('#')) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
            g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
            b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
        } else if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else {
            return 'rgba(255, 215, 0, 0.8)'; // Fallback for invalid hex
        }
    } else {
        // Just fallback if not hex (though ent.color usually is)
        return 'rgba(255, 215, 0, 0.8)';
    }

    r = 255 - r;
    g = 255 - g;
    b = 255 - b;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
console.log(getInvertedColor('#ff0000', 0.8));
console.log(getInvertedColor('#000000', 0.8));
console.log(getInvertedColor('#ffffff', 0.8));
console.log(getInvertedColor('#123456', 0.8));
