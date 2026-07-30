import { useEffect, useRef, type ReactNode } from 'react'
import decorationImage from '../assets/images/two-column-layout-decoration.png'
import heroImage from '../assets/images/two-column-layout-default-img.png'
import { WorkforceLogoWhite } from '../components/branding/workforce-logo-white'

export function TwoColumnGuestLayout({ children }: { children: ReactNode }) {
  const decorationRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const updateImageSize = () => {
      if (!decorationRef.current) return
      decorationRef.current.style.minWidth = window.innerWidth < 768 ? '170vw' : '45vw'
    }
    updateImageSize()
    window.addEventListener('resize', updateImageSize)
    return () => window.removeEventListener('resize', updateImageSize)
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-stretch md:flex-row">
      <div className="relative min-h-screen w-full overflow-hidden md:w-1/2 md:px-6" style={{ backgroundColor: '#171717' }}>
        <img
          ref={decorationRef}
          src={decorationImage}
          className="pointer-events-none absolute bottom-0 z-0 object-contain"
          alt=""
          style={{
            left: '50%',
            top: '3%',
            transform: 'translateX(-50%)',
            height: 'auto',
            width: 'auto',
          }}
        />
        <div className="relative z-10 flex h-[10vh] flex-row items-center">
          <span className="w-48 pl-6 md:pl-0">
            <WorkforceLogoWhite className="h-auto w-full" />
          </span>
        </div>
        <div className="relative z-10 flex min-h-[90vh] flex-row items-start md:items-center">{children}</div>
      </div>
      <div className="hidden w-1/2 md:block" style={{ backgroundColor: '#171717' }}>
        <img
          src={heroImage}
          className="relative h-screen w-full rounded-3xl object-cover object-center p-4"
          alt="Workforce Research Group feedback dashboard"
        />
      </div>
    </div>
  )
}
