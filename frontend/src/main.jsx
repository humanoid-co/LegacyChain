import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ethers } from 'ethers'
import deployment from './deployment.json'
import abi from './legacyVaultAbi.json'
import './styles.css'

// DEMO ONLY: Hardhat's public local accounts make role switching instant for a live presentation.
const DEMO_MNEMONIC = 'test test test test test test test test test test test junk'
const RPC = import.meta.env.VITE_RPC_URL || ((window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') ? 'http://127.0.0.1:8545' : `${window.location.origin}/rpc`)
const stateNames = ['ALIVE', 'WARNING', 'LEGACY MODE']
const short = (address = '') => address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '—'

function App() {
  const [snapshot, setSnapshot] = useState({ score: 100, state: 0, confirmations: 0, released: false, balance: '0.00', confirmed: [] })
  const [logs, setLogs] = useState([{ day: 0, text: 'Day 0 — LegacyChain vault is active and protected.', type: 'info' }])
  const [pending, setPending] = useState('')
  const [connected, setConnected] = useState(false)
  const [simulation, setSimulation] = useState(false)
  const [day, setDay] = useState(0)
  const [releaseHash, setReleaseHash] = useState('')
  const [showReleaseScreen, setShowReleaseScreen] = useState(true)
  const [runtimeDeployment, setRuntimeDeployment] = useState(null)
  const timers = useRef([])
  const activeDeployment = runtimeDeployment || deployment
  const ready = Boolean(runtimeDeployment?.contractAddress && abi.length)
  const provider = useMemo(() => new ethers.JsonRpcProvider(RPC), [])
  const addLog = useCallback((dayNumber, text, type = 'info') => setLogs(old => [...old, { day: dayNumber, text, type, id: crypto.randomUUID() }]), [])
  useEffect(() => {
    // The server creates this at boot, so every hosted restart gets a fresh local demo vault.
    if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
      setRuntimeDeployment(deployment)
      return
    }
    fetch('/deployment.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(setRuntimeDeployment).catch(() => setRuntimeDeployment(null))
  }, [])

  const contractFor = useCallback((role) => {
    // DEMO ONLY: deriving Hardhat's well-known local accounts avoids real wallet setup.
    const wallet = ethers.HDNodeWallet.fromPhrase(DEMO_MNEMONIC, undefined, `m/44'/60'/0'/0/${role}`).connect(provider)
    return new ethers.Contract(activeDeployment.contractAddress, abi, wallet)
  }, [activeDeployment.contractAddress, provider])

  const refresh = useCallback(async () => {
    if (!ready) return
    try {
      const read = new ethers.Contract(activeDeployment.contractAddress, abi, provider)
      const [score, state, confirmations, released, balance, guardians] = await Promise.all([
        read.lifeScore(), read.lifeState(), read.confirmationCount(), read.released(), provider.getBalance(activeDeployment.contractAddress), read.getGuardians()
      ])
      const confirmed = await Promise.all(guardians.map(g => read.hasConfirmed(g)))
      setSnapshot({ score: Number(score), state: Number(state), confirmations: Number(confirmations), released, balance: Number(ethers.formatEther(balance)).toFixed(2), confirmed })
      setConnected(true)
    } catch { setConnected(false) }
  }, [activeDeployment.contractAddress, provider, ready])

  useEffect(() => { refresh(); const id = setInterval(refresh, 1500); return () => { clearInterval(id); timers.current.forEach(clearTimeout) } }, [refresh])

  useEffect(() => {
    if (!ready) return
    const read = new ethers.Contract(activeDeployment.contractAddress, abi, provider)
    // These are real JSON-RPC event subscriptions; the UI also refreshes state after each tx.
    const onTransition = (from, to, score, event) => addLog(day, `Chain event: ${stateNames[Number(from)]} → ${stateNames[Number(to)]} (score ${score}). Tx: ${short(event.log.transactionHash)}`, 'success')
    const onGuardian = (guardian, count, _needed, event) => addLog(day, `Chain event: guardian ${short(guardian)} confirmed (${count}/2). Tx: ${short(event.log.transactionHash)}`, 'success')
    const onRelease = (_beneficiary, amount, event) => { setReleaseHash(event.log.transactionHash); addLog(37, `Chain event: ${ethers.formatEther(amount)} ETH released. Tx: ${short(event.log.transactionHash)}`, 'success') }
    read.on('LifeStateTransition', onTransition)
    read.on('GuardianConfirmed', onGuardian)
    read.on('AssetsReleased', onRelease)
    return () => { read.off('LifeStateTransition', onTransition); read.off('GuardianConfirmed', onGuardian); read.off('AssetsReleased', onRelease) }
  }, [activeDeployment.contractAddress, addLog, day, provider, ready])

  async function transact(label, role, action, logDay, success) {
    setPending(label)
    try {
      const tx = await action(contractFor(role))
      addLog(logDay, `${success} Tx: ${short(tx.hash)}`, 'success')
      await tx.wait()
      await refresh()
      return tx.hash
    } catch (error) {
      addLog(logDay, `Could not complete action: ${error.shortMessage || error.message}`, 'error')
      return null
    } finally { setPending('') }
  }

  async function checkIn() {
    const hash = await transact('Checking in…', 0, c => c.checkIn(), 0, 'Check-in recorded on-chain. Life Score restored to 100.')
    if (hash) { setSimulation(false); setDay(0) }
  }

  function schedule(ms, job) { timers.current.push(setTimeout(job, ms)) }
  function startSimulation() {
    if (simulation || snapshot.released) return
    setSimulation(true); setDay(0); addLog(0, 'Simulation clock started — each milestone will submit a real contract transaction.', 'info')
    schedule(5000, async () => {
      setDay(15); addLog(15, 'Day 15 — inactivity signal lowers Life Score to 55.', 'warning')
      await transact('Recording Day 15…', 0, c => c.setLifeScore(55), 15, 'WARNING state recorded on-chain.')
    })
    schedule(10500, async () => {
      setDay(25); addLog(25, 'Day 25 — score falls to 25; guardian vote is now eligible.', 'danger')
      await transact('Recording Day 25…', 0, c => c.setLifeScore(25), 25, 'LEGACY MODE recorded on-chain. Guardians may now confirm.')
    })
    schedule(12500, () => { setDay(30); addLog(30, 'Day 30 — awaiting Guardian 1 confirmation.', 'warning') })
  }

  async function confirmGuardian(index) {
    const virtualDay = snapshot.confirmations === 0 ? 30 : 33
    setDay(virtualDay)
    const hash = await transact(`Guardian ${index + 1} confirming…`, index + 2, c => c.confirmRelease(), virtualDay, `Guardian ${index + 1} confirmation recorded on-chain.`)
    if (hash && snapshot.confirmations === 0) addLog(33, 'Day 33 — awaiting a second independent guardian confirmation.', 'warning')
  }
  async function executeRelease() {
    setDay(37)
    const hash = await transact('Executing release…', 0, c => c.executeRelease(), 37, 'Assets released to beneficiary on-chain.')
    if (hash) setReleaseHash(hash)
    setSimulation(false)
  }

  const tone = snapshot.released ? 'released' : ['alive', 'warning', 'legacy'][snapshot.state]
  if (!ready) return <main className="shell"><section className="setup"><p className="eyebrow">LEGACYCHAIN / LOCAL DEMO</p><h1>Deploy the vault first.</h1><p>Run <code>npm run chain</code>, then <code>npm run deploy</code> from the project root and refresh this page.</p></section></main>
  return <main className="shell">
    <header><div className="brand"><span className="mark">L</span><span>LegacyChain</span></div><div className={`network ${connected ? 'online' : ''}`}><i /> {connected ? 'Local Hardhat · Connected' : 'Local chain unavailable'}</div></header>
    <section className="hero"><p className="eyebrow">DIGITAL LEGACY, ON YOUR TERMS</p><h1>What happens to your digital life when you can no longer control it?</h1><p>LegacyChain monitors a simple Life Score, coordinates trusted guardians, and releases a protected crypto vault only when the conditions are met.</p></section>
    {snapshot.released && showReleaseScreen ? <section className="released-card"><span>✓</span><div><p className="eyebrow">ON-CHAIN FINALITY</p><h2>Assets Released</h2><p>The vault has transferred its test ETH to {short(activeDeployment.beneficiary)}.</p><p className="hash">Tx hash: {releaseHash || 'Recorded on local chain (refresh after release to view in timeline).'}</p><button className="back-button" onClick={() => setShowReleaseScreen(false)}>← Back to dashboard</button></div></section> : <>
      {snapshot.released && <section className="released-notice"><span>✓</span><span>This vault has been released. Review its chain timeline below, or redeploy a fresh local vault to replay the demo.</span><button onClick={() => setShowReleaseScreen(true)}>View release</button></section>}
      <section className="grid top-grid"><article className={`gauge-card ${tone}`}><div className="card-title"><span>Life Score</span><span className="badge">{stateNames[snapshot.state]}</span></div><div className="gauge"><div className="gauge-value">{snapshot.score}<small>/100</small></div></div><p>{snapshot.state === 0 ? 'You are active. Your digital life stays in your control.' : snapshot.state === 1 ? 'Check in now to restore your active status.' : 'Guardian confirmations are required to release the vault.'}</p><button onClick={checkIn} disabled={Boolean(pending)}>{pending === 'Checking in…' ? pending : "I'm Active — Check In"}</button></article>
      <article className="vault-card"><p className="eyebrow">PROTECTED TEST VAULT</p><h2>{snapshot.balance} ETH</h2><p>Mock crypto asset secured by <span className="pill">Local Smart Contract</span></p><div className="asset-row"><span>⌁</span><div><strong>Digital Estate Vault</strong><small>{short(activeDeployment.contractAddress)}</small></div></div><button className="simulate" onClick={startSimulation} disabled={Boolean(pending) || simulation}>{simulation ? 'SIMULATION RUNNING…' : 'SIMULATE MY INACTIVITY'}</button></article></section>
      <section className="guardians"><div><p className="eyebrow">TRUSTED GUARDIANS</p><h2>2 of 3 confirmations unlock release</h2></div><span className="vote-count">{snapshot.confirmations} / 2 confirmed</span><div className="guardian-grid">{activeDeployment.guardians.map((address, index) => <article className="guardian" key={address}><div className="avatar">{index + 1}</div><div><strong>Guardian {index + 1}</strong><small>{short(address)}</small></div><button onClick={() => confirmGuardian(index)} disabled={Boolean(pending) || snapshot.state !== 2 || snapshot.confirmed[index]}>{snapshot.confirmed[index] ? 'Confirmed ✓' : pending.includes(`Guardian ${index + 1}`) ? 'Confirming…' : 'Confirm Release'}</button></article>)}</div>
      {snapshot.confirmations >= 2 && <button className="execute" onClick={executeRelease} disabled={Boolean(pending)}>{pending === 'Executing release…' ? pending : 'Day 37 — Execute On-chain Release'}</button>}</section>
    </>}
    <section className="timeline"><div className="timeline-heading"><div><p className="eyebrow">SIMULATION CLOCK</p><h2>Day {day} <span>· full lifecycle compressed for demo</span></h2></div><span className="live-dot">LIVE CHAIN EVENTS</span></div><div className="events">{logs.slice().reverse().map((item, index) => <div className={`event ${item.type}`} key={item.id || index}><b>DAY {item.day}</b><span>{item.text}</span></div>)}</div></section>
    <footer>Hackathon prototype — mock identity, mock Life Score inputs, local-only Hardhat chain. Never use with real assets.</footer>
  </main>
}
createRoot(document.getElementById('root')).render(<App />)
