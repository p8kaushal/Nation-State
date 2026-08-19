/**
 * Generates an inline SVG representing the presidential office background scene.
 * Decoupled from game state. Styled with low-contrast, desaturated institutional navy/gold tones
 * to act as a background layer behind decision cards.
 */
export function getOfficeBgSvg(): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="display: block; opacity: 0.85;">
      <!-- Office Wall Background (Muted Dark Navy) -->
      <rect width="800" height="500" fill="#061226" />
      <path d="M0,0 L800,0 L800,500 L0,500 Z" fill="url(#wallGradient)" opacity="0.3" />
      
      <defs>
        <!-- Soft ambient lighting gradient -->
        <radialGradient id="wallGradient" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#1A2D4C" />
          <stop offset="100%" stop-color="#061226" />
        </radialGradient>
        
        <!-- Gold color gradient for institutional seal/trim -->
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#B8860B" />
          <stop offset="50%" stop-color="#8B6508" />
          <stop offset="100%" stop-color="#4A3600" />
        </linearGradient>
      </defs>

      <!-- Arch Window (Right Side) -->
      <g opacity="0.25">
        <!-- Window frame -->
        <path d="M550,400 V150 C550,70 700,70 700,150 V400 Z" fill="#0C1F3D" />
        <!-- Window panes & soft daylight silhouette -->
        <path d="M560,390 V160 C560,95 690,95 690,160 V390 Z" fill="#142B52" />
        <!-- Window frame grid panes -->
        <line x1="625" y1="100" x2="625" y2="390" stroke="#061226" stroke-width="3" />
        <line x1="560" y1="200" x2="690" y2="200" stroke="#061226" stroke-width="2" />
        <line x1="560" y1="290" x2="690" y2="290" stroke="#061226" stroke-width="2" />
        <!-- Distant capital dome silhouette visible through window -->
        <path d="M600,390 V320 C600,320 605,300 625,300 C645,300 650,320 650,320 V390 Z" fill="#081428" />
        <path d="M620,300 V280 H630 V300 Z" fill="#081428" />
        <circle cx="625" cy="275" r="3" fill="#081428" />
      </g>

      <!-- Executive Flagpole & Draped Flag (Left Side) -->
      <g opacity="0.3">
        <!-- Gold flagpole cap -->
        <circle cx="120" cy="80" r="6" fill="url(#goldGradient)" />
        <line x1="120" y1="80" x2="120" y2="450" stroke="#7A6021" stroke-width="4" />
        <!-- Flag fabric folds (Muted Blue and Gold trim) -->
        <path d="M120,95 C130,120 160,110 165,150 C170,180 140,210 150,260 C155,290 175,320 160,360 L120,380 Z" fill="#1A335C" />
        <!-- Gold Fringe -->
        <path d="M165,150 C170,180 140,210 150,260 C155,290 175,320 160,360 L154,363 C169,323 149,293 144,263 C134,213 164,183 159,153 Z" fill="url(#goldGradient)" />
        <!-- Flag secondary folds -->
        <path d="M120,95 C125,120 140,130 135,170 C130,200 120,230 130,280 C135,310 145,330 130,370 L120,380 Z" fill="#0F203D" />
      </g>

      <!-- High-Back Executive Chair Silhouette (Center Background) -->
      <g opacity="0.4">
        <!-- Chair headrest -->
        <rect x="340" y="140" width="120" height="40" rx="15" fill="#081224" stroke="#0B1B3D" stroke-width="2" />
        <!-- Chair backrest support -->
        <path d="M330,180 C330,180 320,350 320,380 H480 C480,350 470,180 470,180 Z" fill="#050C1A" stroke="#0B1B3D" stroke-width="2" />
        <!-- Cushion contours -->
        <path d="M360,200 H440 V350 H360 Z" fill="#081224" opacity="0.5" />
      </g>

      <!-- Wooden Oval Desk (Bottom Foreground) -->
      <g>
        <!-- Desk Rim / Edge (Deep Mahogany / Muted Gold Trim) -->
        <ellipse cx="400" cy="450" rx="450" ry="120" fill="#100A05" />
        <ellipse cx="400" cy="445" rx="448" ry="118" fill="#1F150D" />
        <ellipse cx="400" cy="445" rx="448" ry="118" fill="url(#goldGradient)" opacity="0.15" />
        
        <!-- Leather Desk Blotter (Center Foreground) -->
        <ellipse cx="400" cy="455" rx="280" ry="85" fill="#0D182B" stroke="#162A4A" stroke-width="2" />
        
        <!-- Gold Presidential Seal (Embossed on Desk Center) -->
        <g transform="translate(400, 420) scale(0.65)" opacity="0.35">
          <!-- Outer Gold Rings -->
          <circle cx="0" cy="0" r="60" fill="none" stroke="url(#goldGradient)" stroke-width="4" />
          <circle cx="0" cy="0" r="54" fill="none" stroke="url(#goldGradient)" stroke-width="1.5" stroke-dasharray="4,3" />
          
          <!-- Seal Eagle Silhouette / Emblem -->
          <path d="M-15,-5 C-25,-10 -35,-5 -35,-5 C-30,5 -20,10 -15,10 C-12,8 -10,12 -5,12 C0,12 2,8 5,10 C10,10 20,5 25,-5 C25,-5 15,-10 5,-5 C3,-3 2,-8 0,-8 C-2,-8 -3,-3 -15,-5 Z" fill="url(#goldGradient)" />
          <!-- Wings -->
          <path d="M-15,-5 C-20,-25 -35,-35 -45,-30 C-35,-20 -25,-10 -15,-5 Z" fill="url(#goldGradient)" />
          <path d="M5,-5 C10,-25 25,-35 35,-30 C25,-20 15,-10 5,-5 Z" fill="url(#goldGradient)" />
          <!-- Head / Crest -->
          <path d="M-5,-8 C-5,-15 -2,-20 -5,-25 C-2,-23 2,-23 5,-25 C2,-20 5,-15 5,-8 Z" fill="url(#goldGradient)" />
          <!-- Olive Branch & Arrows in Talons -->
          <line x1="-20" y1="12" x2="-35" y2="22" stroke="url(#goldGradient)" stroke-width="2" />
          <line x1="10" y1="12" x2="25" y2="22" stroke="url(#goldGradient)" stroke-width="2" />
        </g>
      </g>
    </svg>
  `;
}
