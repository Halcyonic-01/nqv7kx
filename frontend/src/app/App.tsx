import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { AccuracyPage } from '../features/accuracy/AccuracyPage'
import { DayAheadIndex, DayAheadPage } from '../features/day-ahead/DayAheadPage'
import { TopBar } from './TopBar'

function Shell() {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-[1280px] px-4 pt-5 pb-16 sm:px-6">
        <Outlet />
      </main>
    </>
  )
}

function ToDayAhead() {
  const { search } = useLocation()
  return <Navigate replace to={`/day-ahead${search}`} />
}

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="day-ahead" element={<DayAheadIndex />} />
        <Route path="day-ahead/:date" element={<DayAheadPage />} />
        <Route path="accuracy" element={<AccuracyPage />} />
        <Route path="*" element={<ToDayAhead />} />
      </Route>
    </Routes>
  )
}
