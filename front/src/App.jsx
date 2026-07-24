import IdeaForm from './IdeaForm'
import './App.css'

function App() {
  return (
    <>
      <section id="center">
        <div className="hero">
          <h1>JARVIS Creator</h1>
        </div>
      </section>
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem' }}>
        <IdeaForm />
      </main>
    </>
  )
}

export default App