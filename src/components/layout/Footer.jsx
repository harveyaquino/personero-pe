export function Footer() {
  return (
    <footer className="mt-12 pb-6 text-center">
      <div className="inline-flex flex-col items-center gap-1">
        <p className="text-xs text-gray-400">
          Desarrollado por{' '}
          <a
            href="https://www.linkedin.com/in/harveyaquinomas/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 font-medium hover:text-rojo transition-colors underline underline-offset-2"
          >
            Harvey Aquino Mas
          </a>
        </p>
        <a
          href="https://www.linkedin.com/in/harveyaquinomas/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-azul transition-colors group"
        >
          {/* LinkedIn icon */}
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          <span className="group-hover:underline underline-offset-2">linkedin.com/in/harveyaquinomas</span>
        </a>
        <p className="text-[10px] text-gray-300 mt-0.5">Personero.pe · Elecciones Generales 2026 · Perú</p>
      </div>
    </footer>
  )
}
