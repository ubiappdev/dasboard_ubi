import { useMemo, useState } from 'react';
import { Award, DollarSign, Plus, Save, Tag } from 'lucide-react';
import type { FeeItem, ScholarshipType, Student, ToastPush } from '@/types';
import { formatBs } from '@/lib/format';
import { supabase } from '@/lib/supabase';

interface FeesViewProps {
  fees: FeeItem[];
  setFees: React.Dispatch<React.SetStateAction<FeeItem[]>>;
  scholarships: ScholarshipType[];
  setScholarships: React.Dispatch<React.SetStateAction<ScholarshipType[]>>;
  students: Student[];
  pushToast: ToastPush;
}

export default function FeesView({ fees, setFees, scholarships, setScholarships, students, pushToast }: FeesViewProps) {
  const [tab, setTab] = useState<'fees' | 'scholarships' | 'other'>('fees');
  const [category, setCategory] = useState<string>('all');
  const [newFee, setNewFee] = useState({ concepto: '', codigo: '', monto: '', categoria: 'general' });
  const [newScholarship, setNewScholarship] = useState({ nombre: '', porcentaje: '', descripcion: '' });
  const shownFees = useMemo(() => fees.filter((fee) => category === 'all' || fee.categoria === category), [fees, category]);

  const saveFee = async () => {
    const amount = Number(newFee.monto);
    if (!newFee.concepto || !amount) {
      pushToast('error', 'Completa el concepto y el monto.');
      return;
    }
    const { data, error } = await supabase
      .from('aranceles_conceptos')
      .insert({ codigo: newFee.codigo || `UBI-${Date.now().toString().slice(-4)}`, concepto: newFee.concepto, monto: amount, categoria: newFee.categoria, activo: true })
      .select('*')
      .single();
    if (error) {
      console.error(error);
      pushToast('error', 'No se pudo guardar el arancel.');
      return;
    }
    setFees((current) => [...current, { id: data.id, codigo: data.codigo, concepto: data.concepto, categoria: data.categoria, monto: Number(data.monto), activo: data.activo }]);
    setNewFee({ concepto: '', codigo: '', monto: '', categoria: 'general' });
    pushToast('success', 'Arancel guardado en la base de datos.');
  };

  const saveScholarship = async () => {
    const percentage = Number(newScholarship.porcentaje);
    if (!newScholarship.nombre || percentage < 0 || percentage > 100) {
      pushToast('error', 'Completa una beca con porcentaje entre 0 y 100.');
      return;
    }
    const { data, error } = await supabase
      .from('tipos_beca')
      .insert({ nombre: newScholarship.nombre, porcentaje_descuento: percentage, descripcion: newScholarship.descripcion || null, activo: true })
      .select('*')
      .single();
    if (error) {
      console.error(error);
      pushToast('error', 'No se pudo guardar la beca.');
      return;
    }
    setScholarships((current) => [...current, { id: data.id, nombre: data.nombre, porcentaje: Number(data.porcentaje_descuento), descripcion: data.descripcion ?? undefined, activo: data.activo }]);
    setNewScholarship({ nombre: '', porcentaje: '', descripcion: '' });
    pushToast('success', 'Beca guardada en la base de datos.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 rounded-lg bg-ink-100 p-1 w-fit">
        <button className={`btn ${tab === 'fees' ? 'bg-white text-navy-800 shadow-sm' : 'text-ink-500'}`} onClick={() => setTab('fees')}>
          <DollarSign className="h-4 w-4" /> Aranceles
        </button>
        <button className={`btn ${tab === 'scholarships' ? 'bg-white text-navy-800 shadow-sm' : 'text-ink-500'}`} onClick={() => setTab('scholarships')}>
          <Award className="h-4 w-4" /> Becas
        </button>
        <button className={`btn ${tab === 'other' ? 'bg-white text-navy-800 shadow-sm' : 'text-ink-500'}`} onClick={() => setTab('other')}>
          <Tag className="h-4 w-4" /> Otros
        </button>
      </div>

      {tab === 'fees' && (
        <>
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-bold text-ink-900">Catálogo de pagos</h3>
                <p className="text-sm text-ink-500">Mensualidades, matrícula y aranceles oficiales.</p>
              </div>
              <select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">Todas las categorías</option>
                {Array.from(new Set(fees.map((f) => f.categoria))).sort().map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {shownFees.map((fee) => (
              <div className="card p-5" key={fee.id}>
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <span className="badge-gray">{fee.categoria}</span>
                </div>
                <h4 className="font-bold text-ink-900 mt-4">{fee.concepto}</h4>
                <p className="text-xs text-ink-400 mt-1 font-mono">{fee.codigo}</p>
                <p className="text-xl font-bold text-navy-800 mt-4">Bs {formatBs(fee.monto)}</p>
              </div>
            ))}
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-ink-900 mb-4">Agregar arancel</h3>
            <div className="grid md:grid-cols-4 gap-3">
              <input className="input" placeholder="Concepto" value={newFee.concepto} onChange={(e) => setNewFee({ ...newFee, concepto: e.target.value })} />
              <input className="input" placeholder="Código (ej: UBI-001)" value={newFee.codigo} onChange={(e) => setNewFee({ ...newFee, codigo: e.target.value })} />
              <input className="input" type="number" placeholder="Monto Bs" value={newFee.monto} onChange={(e) => setNewFee({ ...newFee, monto: e.target.value })} />
              <input className="input" placeholder="Categoría" value={newFee.categoria} onChange={(e) => setNewFee({ ...newFee, categoria: e.target.value })} />
            </div>
            <button className="btn-primary mt-4" onClick={saveFee}>
              <Save className="h-4 w-4" /> Guardar arancel
            </button>
          </div>
        </>
      )}

      {tab === 'scholarships' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scholarships.map((scholarship) => (
              <div className="card p-5" key={scholarship.id}>
                <div className="flex items-center justify-between">
                  <Award className="h-6 w-6 text-amber-600" />
                  <span className="text-2xl font-bold text-navy-800">{scholarship.porcentaje}%</span>
                </div>
                <h3 className="font-bold mt-4">{scholarship.nombre}</h3>
                {scholarship.descripcion && <p className="text-sm text-ink-500 mt-1">{scholarship.descripcion}</p>}
                <p className="text-xs text-ink-400 mt-2">{students.filter((student) => student.tipoBecaId === scholarship.id).length} estudiantes asignados</p>
              </div>
            ))}
          </div>

          <div className="card p-6">
            <h3 className="font-bold text-ink-900 mb-4">Agregar tipo de beca</h3>
            <div className="flex flex-wrap gap-3 max-w-2xl">
              <input className="input" placeholder="Nombre de la beca" value={newScholarship.nombre} onChange={(e) => setNewScholarship({ ...newScholarship, nombre: e.target.value })} />
              <input className="input w-36" type="number" placeholder="%" value={newScholarship.porcentaje} onChange={(e) => setNewScholarship({ ...newScholarship, porcentaje: e.target.value })} />
              <input className="input flex-1" placeholder="Descripción (opcional)" value={newScholarship.descripcion} onChange={(e) => setNewScholarship({ ...newScholarship, descripcion: e.target.value })} />
              <button className="btn-primary" onClick={saveScholarship}>
                <Plus className="h-4 w-4" /> Agregar
              </button>
            </div>
          </div>
        </>
      )}

      {tab === 'other' && (
        <div className="card p-8">
          <h3 className="font-bold text-ink-900">Otros conceptos</h3>
          <p className="text-sm text-ink-500 mt-2">Esta sección queda separada de mensualidades y becas para administrar certificados, graduación y otros cargos sin mezclarlos con la conciliación de pagos.</p>
        </div>
      )}
    </div>
  );
}
