import { useMemo, useState } from 'react';
import { Award, DollarSign, Plus, Save, Tag, Edit2, X } from 'lucide-react';
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
  
  // Estados para formularios y edición
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [newFee, setNewFee] = useState({ concepto: '', codigo: '', monto: '', categoria: 'general' });

  const [editingScholarshipId, setEditingScholarshipId] = useState<string | null>(null);
  const [newScholarship, setNewScholarship] = useState({ nombre: '', porcentaje: '', descripcion: '' });

  const shownFees = useMemo(() => fees.filter((fee) => category === 'all' || fee.categoria === category), [fees, category]);

  // --- ARANCELERÍA (FEE ITEMS) ---
  const handleEditFeeClick = (fee: FeeItem) => {
    setEditingFeeId(fee.id);
    setNewFee({
      concepto: fee.concepto,
      codigo: fee.codigo,
      monto: fee.monto.toString(),
      categoria: fee.categoria,
    });
  };

  const handleCancelFeeEdit = () => {
    setEditingFeeId(null);
    setNewFee({ concepto: '', codigo: '', monto: '', categoria: 'general' });
  };

  const saveFee = async () => {
    const amount = Number(newFee.monto);
    if (!newFee.concepto || isNaN(amount)) {
      pushToast('error', 'Completa el concepto y un monto válido.');
      return;
    }

    if (editingFeeId) {
      // Editar arancel existente
      const { data, error } = await supabase
        .from('aranceles_conceptos')
        .update({
          codigo: newFee.codigo || `UBI-${Date.now().toString().slice(-4)}`,
          concepto: newFee.concepto,
          monto: amount,
          categoria: newFee.categoria,
        })
        .eq('id', editingFeeId)
        .select('*')
        .single();

      if (error) {
        console.error(error);
        pushToast('error', 'No se pudo actualizar el arancel.');
        return;
      }

      setFees((current) => current.map((f) => f.id === editingFeeId ? {
        id: data.id,
        codigo: data.codigo,
        concepto: data.concepto,
        categoria: data.categoria,
        monto: Number(data.monto),
        activo: data.activo,
      } : f));

      pushToast('success', 'Arancel actualizado correctamente.');
      handleCancelFeeEdit();
    } else {
      // Crear nuevo arancel
      const { data, error } = await supabase
        .from('aranceles_conceptos')
        .insert({
          codigo: newFee.codigo || `UBI-${Date.now().toString().slice(-4)}`,
          concepto: newFee.concepto,
          monto: amount,
          categoria: newFee.categoria,
          activo: true,
        })
        .select('*')
        .single();

      if (error) {
        console.error(error);
        pushToast('error', 'No se pudo guardar el arancel.');
        return;
      }

      setFees((current) => [...current, {
        id: data.id,
        codigo: data.codigo,
        concepto: data.concepto,
        categoria: data.categoria,
        monto: Number(data.monto),
        activo: data.activo,
      }]);

      setNewFee({ concepto: '', codigo: '', monto: '', categoria: 'general' });
      pushToast('success', 'Arancel guardado en la base de datos.');
    }
  };

  // --- BECAS (SCHOLARSHIPS) ---
  const handleEditScholarshipClick = (scholarship: ScholarshipType) => {
    setEditingScholarshipId(scholarship.id);
    setNewScholarship({
      nombre: scholarship.nombre,
      porcentaje: scholarship.porcentaje.toString(),
      descripcion: scholarship.descripcion || '',
    });
  };

  const handleCancelScholarshipEdit = () => {
    setEditingScholarshipId(null);
    setNewScholarship({ nombre: '', porcentaje: '', descripcion: '' });
  };

  const saveScholarship = async () => {
    const percentage = Number(newScholarship.porcentaje);
    if (!newScholarship.nombre || isNaN(percentage) || percentage < 0 || percentage > 100) {
      pushToast('error', 'Completa el nombre y un porcentaje válido entre 0 y 100.');
      return;
    }

    if (editingScholarshipId) {
      // Editar beca existente
      const { data, error } = await supabase
        .from('tipos_beca')
        .update({
          nombre: newScholarship.nombre,
          porcentaje_descuento: percentage,
          descripcion: newScholarship.descripcion || null,
        })
        .eq('id', editingScholarshipId)
        .select('*')
        .single();

      if (error) {
        console.error(error);
        pushToast('error', 'No se pudo actualizar la beca.');
        return;
      }

      setScholarships((current) => current.map((s) => s.id === editingScholarshipId ? {
        id: data.id,
        nombre: data.nombre,
        porcentaje: Number(data.porcentaje_descuento),
        descripcion: data.descripcion ?? undefined,
        activo: data.activo,
      } : s));

      pushToast('success', 'Beca actualizada correctamente.');
      handleCancelScholarshipEdit();
    } else {
      // Crear nueva beca
      const { data, error } = await supabase
        .from('tipos_beca')
        .insert({
          nombre: newScholarship.nombre,
          porcentaje_descuento: percentage,
          descripcion: newScholarship.descripcion || null,
          activo: true,
        })
        .select('*')
        .single();

      if (error) {
        console.error(error);
        pushToast('error', 'No se pudo guardar la beca.');
        return;
      }

      setScholarships((current) => [...current, {
        id: data.id,
        nombre: data.nombre,
        porcentaje: Number(data.porcentaje_descuento),
        descripcion: data.descripcion ?? undefined,
        activo: data.activo,
      }]);

      setNewScholarship({ nombre: '', porcentaje: '', descripcion: '' });
      pushToast('success', 'Beca guardada en la base de datos.');
    }
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
              <div className="card p-5 relative flex flex-col justify-between" key={fee.id}>
                <div>
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="badge-gray">{fee.categoria}</span>
                      <button 
                        onClick={() => handleEditFeeClick(fee)} 
                        className="p-1.5 text-ink-400 hover:text-navy-600 hover:bg-ink-100 rounded-lg transition"
                        title="Editar arancel"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-ink-900 mt-4">{fee.concepto}</h4>
                  <p className="text-xs text-ink-400 mt-1 font-mono">{fee.codigo}</p>
                </div>
                <p className="text-xl font-bold text-navy-800 mt-4">Bs {formatBs(fee.monto)}</p>
              </div>
            ))}
          </div>

          <div className="card p-6 border-2 border-dashed border-ink-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-ink-900">
                {editingFeeId ? 'Editar arancel seleccionado' : 'Agregar nuevo arancel'}
              </h3>
              {editingFeeId && (
                <button onClick={handleCancelFeeEdit} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
                  <X className="h-3.5 w-3.5" /> Cancelar edición
                </button>
              )}
            </div>
            <div className="grid md:grid-cols-4 gap-3">
              <input className="input" placeholder="Concepto" value={newFee.concepto} onChange={(e) => setNewFee({ ...newFee, concepto: e.target.value })} />
              <input className="input" placeholder="Código (ej: UBI-001)" value={newFee.codigo} onChange={(e) => setNewFee({ ...newFee, codigo: e.target.value })} />
              <input className="input" type="number" placeholder="Monto Bs" value={newFee.monto} onChange={(e) => setNewFee({ ...newFee, monto: e.target.value })} />
              <input className="input" placeholder="Categoría" value={newFee.categoria} onChange={(e) => setNewFee({ ...newFee, categoria: e.target.value })} />
            </div>
            <button className="btn-primary mt-4" onClick={saveFee}>
              <Save className="h-4 w-4" /> {editingFeeId ? 'Actualizar arancel' : 'Guardar arancel'}
            </button>
          </div>
        </>
      )}

      {tab === 'scholarships' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scholarships.map((scholarship) => (
              <div className="card p-5 relative flex flex-col justify-between" key={scholarship.id}>
                <div>
                  <div className="flex items-center justify-between">
                    <Award className="h-6 w-6 text-amber-600" />
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-navy-800">{scholarship.porcentaje}%</span>
                      <button 
                        onClick={() => handleEditScholarshipClick(scholarship)} 
                        className="p-1.5 text-ink-400 hover:text-navy-600 hover:bg-ink-100 rounded-lg transition"
                        title="Editar beca"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-bold mt-4">{scholarship.nombre}</h3>
                  {scholarship.descripcion && <p className="text-sm text-ink-500 mt-1">{scholarship.descripcion}</p>}
                </div>
                <p className="text-xs text-ink-400 mt-4">{students.filter((student) => student.tipoBecaId === scholarship.id).length} estudiantes asignados</p>
              </div>
            ))}
          </div>

          <div className="card p-6 border-2 border-dashed border-ink-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-ink-900">
                {editingScholarshipId ? 'Editar tipo de beca' : 'Agregar tipo de beca'}
              </h3>
              {editingScholarshipId && (
                <button onClick={handleCancelScholarshipEdit} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
                  <X className="h-3.5 w-3.5" /> Cancelar edición
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3 max-w-2xl">
              <input className="input" placeholder="Nombre de la beca" value={newScholarship.nombre} onChange={(e) => setNewScholarship({ ...newScholarship, nombre: e.target.value })} />
              <input className="input w-36" type="number" placeholder="%" value={newScholarship.porcentaje} onChange={(e) => setNewScholarship({ ...newScholarship, porcentaje: e.target.value })} />
              <input className="input flex-1" placeholder="Descripción (opcional)" value={newScholarship.descripcion} onChange={(e) => setNewScholarship({ ...newScholarship, descripcion: e.target.value })} />
              <button className="btn-primary" onClick={saveScholarship}>
                {editingScholarshipId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />} 
                {editingScholarshipId ? 'Actualizar beca' : 'Agregar'}
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