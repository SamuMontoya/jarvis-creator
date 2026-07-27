function Spinner({ label = 'Cargando...' }) {
  return (
    <div role="status" className="flex flex-col items-center gap-4 px-4 py-12 text-stone">
      <div
        className="h-9 w-9 rounded-full border-[3px] border-dust"
        style={{ borderTopColor: 'var(--color-amber)', animation: 'ds-spin 0.8s linear infinite' }}
      />
      <p className="m-0 font-body text-sm">{label}</p>
    </div>
  );
}

export default Spinner;
