const DesignGuide = () => {
  return (
    <div className="p-8 space-y-12 bg-background text-foreground min-h-screen font-sans">
      {/* Typography */}
      <section>
        <h2 className="text-h2 mb-4 font-bold">Typography</h2>
        <div className="space-y-2">
          <h1 className="text-h1">Heading 1</h1>
          <h2 className="text-h2">Heading 2</h2>
          <p className="text-body">This is body text for general content areas.</p>
          <p className="text-small text-muted">This is small muted text.</p>
        </div>
      </section>

      {/* Buttons */}
      <section>
        <h2 className="text-h2 mb-4 font-bold">Buttons</h2>
        <div className="space-x-4">
          <button className="bg-primary text-white px-6 py-2 rounded-xl shadow-soft hover:bg-primary/90 transition">Primary</button>
          <button className="bg-accent text-black px-6 py-2 rounded-xl shadow-soft hover:bg-accent/90 transition">Accent</button>
          <button className="bg-muted text-foreground px-6 py-2 rounded-xl shadow-soft hover:bg-muted/80 transition">Muted</button>
        </div>
      </section>

      {/* Badges */}
      <section>
        <h2 className="text-h2 mb-4 font-bold">Level Badges</h2>
        <div className="space-x-4">
          <span className="bg-badge-level1 text-xs px-3 py-1 rounded-full">Level 1</span>
          <span className="bg-badge-level2 text-xs px-3 py-1 rounded-full">Level 2</span>
          <span className="bg-badge-level3 text-xs px-3 py-1 rounded-full">Level 3</span>
        </div>
      </section>

      {/* Shadows & Spacing */}
      <section>
        <h2 className="text-h2 mb-4 font-bold">Card Example</h2>
        <div className="bg-white p-card rounded-xl shadow-strong max-w-md">
          <h3 className="text-h2 mb-2">Story Card Title</h3>
          <p className="text-body">This card uses spacing, shadow, and rounded tokens from your design system.</p>
        </div>
      </section>

      {/* Colors */}
      <section>
        <h2 className="text-h2 mb-4 font-bold">Color Palette</h2>
        <div className="grid grid-cols-3 gap-4 max-w-md">
          {['primary', 'accent', 'background', 'foreground', 'muted', 'success', 'warning', 'danger'].map(color => (
            <div key={color} className={`p-4 rounded-xl bg-${color} text-sm shadow-soft text-center text-white`}>.{color}</div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DesignGuide;
