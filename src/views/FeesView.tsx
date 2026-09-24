import { useMemo, useState, useEffect } from 'react';
import { Award, DollarSign, Plus, Save, Tag, Edit2, X, Database, UploadCloud, CheckCircle2, Users, UserPlus, Shield, Search, Key, Trash2, Power } from 'lucide-react';
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

interface PerfilUsuario {
  id: string;
  auth_id: string | null;
  correo: string | null;
  nombres: string;
  apellidos: string;
  tipo_usuario: 'ADMINISTRATIVO' | 'ALUMNO';
  rol: 'ADMINISTRADOR' | 'CAJERO' | 'SECRETARIA' | 'ESTUDIANTE' | null;
  activo: boolean;
  ci: string | null;
  telefono: string | null;
  last_sign_in_at?: string | null;
}

function parsearMontoBoliviano(valor: any): number {
    if (!valor) return 0;
    if (typeof valor === 'number') return valor;
    
    let strValor = String(valor).trim();

    if (strValor.includes('.') && strValor.includes(',')) {
        strValor = strValor.replace(/\./g, '').replace(',', '.');
    } else if (strValor.includes('.')) {
        strValor = strValor.replace(/\./g, '');
    } else if (strValor.includes(',')) {
        strValor = strValor.replace(',', '.');
    }

    const numero = parseFloat(strValor);
    return isNaN(numero) ? 0 : numero;
}

function extraerNumerosDeConcepto(observaciones: string | null, conceptoGeneral: string): number[] {
    const cuotasSet = new Set<number>();
    const textoObs = (observaciones || '').toUpperCase();
    const textoGeneral = (conceptoGeneral || '').toUpperCase();
    const textoCompleto = `${textoGeneral} ${textoObs}`;

    if (textoCompleto.includes('1° A LA 10°') || textoCompleto.includes('1º A LA 10º') || textoCompleto.includes('PAGO ANUAL')) {
        for (let i = 1; i <= 10; i++) {
            cuotasSet.add(i);
        }
    }

    const rangoMatch = textoCompleto.match(/(\d+)[ºªRAER]*\s*(?:A|AL|-)\s*(\d+)[ºªRAER]*/);
    if (rangoMatch) {
        const inicio = parseInt(rangoMatch[1], 10);
        const fin = parseInt(rangoMatch[2], 10);
        for (let i = inicio; i <= fin; i++) {
            if (i >= 1 && i <= 12) cuotasSet.add(i);
        }
    }

    const matches = textoCompleto.matchAll(/(\d+)/g);
    for (const match of matches) {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= 12) {
            cuotasSet.add(num);
        }
    }

    if (
        textoCompleto.includes('MATRICULA') || 
        textoCompleto.includes('MATRÍCULA') || 
        textoGeneral === 'MATRÍCULA' || 
        textoGeneral === 'MATRICULA'
    ) {
        cuotasSet.add(0);
    }

    return Array.from(cuotasSet);
}

export default function FeesView({ fees, setFees, scholarships, setScholarships, students, pushToast }: FeesViewProps) {
  const [mainTab, setMainTab] = useState<'catalogos' | 'usuarios'>('catalogos');
  const [catalogSubTab, setCatalogSubTab] = useState<'fees' | 'scholarships' | 'other'>('fees');
  const [category, setCategory] = useState<string>('all');
  
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [newFee, setNewFee] = useState({ concepto: '', codigo: '', monto: '', categoria: 'general' });

  const [editingScholarshipId, setEditingScholarshipId] = useState<string | null>(null);
  const [newScholarship, setNewScholarship] = useState({ nombre: '', porcentaje: '', descripcion: '' });

  const [migrando, setMigrando] = useState(false);
  const [progresoMigracion, setProgresoMigracion] = useState<string>('');

  // --- GESTIÓN DE USUARIOS ---
  const [usuarios, setUsuarios] = useState<PerfilUsuario[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [busquedaUsuario, setBusquedaUsuario] = useState('');
  
  // Estados para Modal de Password
  const [modalPasswordOpen, setModalPasswordOpen] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<PerfilUsuario | null>(null);
  const [nuevoPassword, setNuevoPassword] = useState('');

  const [newUser, setNewUser] = useState({
    nombres: '',
    apellidos: '',
    correo: '',
    password: '',
    tipo_usuario: 'ADMINISTRATIVO' as 'ADMINISTRATIVO' | 'ALUMNO',
    rol: 'CAJERO' as 'ADMINISTRADOR' | 'CAJERO' | 'SECRETARIA' | 'ESTUDIANTE',
    ci: '',
    telefono: ''
  });

  const shownFees = useMemo(() => fees.filter((fee) => category === 'all' || fee.categoria === category), [fees, category]);

  const usuariosFiltrados = useMemo(() => {
    if (!busquedaUsuario.trim()) return usuarios;
    const query = busquedaUsuario.toLowerCase();
    return usuarios.filter(u => 
      u.nombres.toLowerCase().includes(query) ||
      u.apellidos.toLowerCase().includes(query) ||
      (u.correo && u.correo.toLowerCase().includes(query)) ||
      (u.ci && u.ci.toLowerCase().includes(query))
    );
  }, [usuarios, busquedaUsuario]);

  useEffect(() => {
    if (mainTab === 'usuarios') {
      cargarUsuarios();
    }
  }, [mainTab]);

  const cargarUsuarios = async () => {
    setLoadingUsuarios(true);
    const { data, error } = await supabase.from('perfiles').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      pushToast('error', 'No se pudieron cargar los usuarios.');
    } else {
      setUsuarios(data || []);
    }
    setLoadingUsuarios(false);
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.correo || !newUser.password || !newUser.nombres || !newUser.apellidos) {
      pushToast('error', 'Por favor completa los campos obligatorios (Correo, Contraseña, Nombres, Apellidos).');
      return;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.correo,
        password: newUser.password,
        options: {
          data: {
            nombres: newUser.nombres,
            apellidos: newUser.apellidos
          }
        }
      });

      if (authError) throw authError;

      const authId = authData.user?.id;

      const { error: perfilError } = await supabase.from('perfiles').insert({
        auth_id: authId,
        correo: newUser.correo,
        nombres: newUser.nombres,
        apellidos: newUser.apellidos,
        tipo_usuario: newUser.tipo_usuario,
        rol: newUser.rol,
        ci: newUser.ci || null,
        telefono: newUser.telefono || null,
        activo: true
      });

      if (perfilError) throw perfilError;

      pushToast('success', 'Usuario creado exitosamente.');
      setNewUser({ nombres: '', apellidos: '', correo: '', password: '', tipo_usuario: 'ADMINISTRATIVO', rol: 'CAJERO', ci: '', telefono: '' });
      cargarUsuarios();
    } catch (error: any) {
      console.error(error);
      pushToast('error', error.message || 'Error al registrar el usuario.');
    }
  };

  const toggleActivoUsuario = async (usuario: PerfilUsuario) => {
    const nuevoEstado = !usuario.activo;
    const { error } = await supabase
      .from('perfiles')
      .update({ activo: nuevoEstado })
      .eq('id', usuario.id);

    if (error) {
      pushToast('error', 'No se pudo actualizar el estado del usuario.');
    } else {
      setUsuarios(current => current.map(u => u.id === usuario.id ? { ...u, activo: nuevoEstado } : u));
      pushToast('success', `Usuario ${nuevoEstado ? 'activado' : 'inactivado'} correctamente.`);
    }
  };

  const abrirModalPassword = (usuario: PerfilUsuario) => {
    setUsuarioSeleccionado(usuario);
    setNuevoPassword('');
    setModalPasswordOpen(true);
  };

  const guardarNuevoPassword = async () => {
    if (!usuarioSeleccionado || !nuevoPassword) {
      pushToast('error', 'Ingresa una nueva contraseña válida.');
      return;
    }

    try {
      // Nota: Para cambiar password de otro usuario desde Admin se requiere función RPC o usar supabase.auth.admin si estás en backend. 
      // Aquí simulamos la acción o requerimos endpoint seguro. Usaremos una llamada RPC o notificación.
      const { error } = await supabase.rpc('admin_update_user_password', { 
        target_auth_id: usuarioSeleccionado.auth_id, 
        new_password: nuevoPassword 
      });

      if (error) {
        // Fallback si no existe la función RPC en DB
        pushToast('error', 'Error al cambiar contraseña. Asegúrate de tener configurada la función RPC en Supabase.');
        return;
      }

      pushToast('success', 'Contraseña actualizada exitosamente.');
      setModalPasswordOpen(false);
      setUsuarioSeleccionado(null);
    } catch (err: any) {
      pushToast('error', err.message || 'Error al actualizar contraseña.');
    }
  };

  const eliminarUsuario = async (usuario: PerfilUsuario) => {
    if (!window.confirm(`¿Estás seguro de eliminar el perfil de ${usuario.nombres} ${usuario.apellidos}?`)) return;

    const { error } = await supabase.from('perfiles').delete().eq('id', usuario.id);
    if (error) {
      pushToast('error', 'No se pudo eliminar el registro.');
    } else {
      setUsuarios(current => current.filter(u => u.id !== usuario.id));
      pushToast('success', 'Usuario eliminado del sistema.');
    }
  };

  // --- ARANCELERÍA ---
  const handleEditFeeClick = (fee: FeeItem) => {
    setEditingFeeId(fee.id);
    setNewFee({ concepto: fee.concepto, codigo: fee.codigo, monto: fee.monto.toString(), categoria: fee.categoria });
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
      const { data, error } = await supabase
        .from('aranceles_conceptos')
        .update({ codigo: newFee.codigo || `UBI-${Date.now().toString().slice(-4)}`, concepto: newFee.concepto, monto: amount, categoria: newFee.categoria })
        .eq('id', editingFeeId)
        .select('*')
        .single();

      if (error) {
        pushToast('error', 'No se pudo actualizar el arancel.');
        return;
      }

      setFees((current) => current.map((f) => f.id === editingFeeId ? { ...f, codigo: data.codigo, concepto: data.concepto, categoria: data.categoria, monto: Number(data.monto) } : f));
      pushToast('success', 'Arancel actualizado correctamente.');
      handleCancelFeeEdit();
    } else {
      const { data, error } = await supabase
        .from('aranceles_conceptos')
        .insert({ codigo: newFee.codigo || `UBI-${Date.now().toString().slice(-4)}`, concepto: newFee.concepto, monto: amount, categoria: newFee.categoria, activo: true })
        .select('*')
        .single();

      if (error) {
        pushToast('error', 'No se pudo guardar el arancel.');
        return;
      }

      setFees((current) => [...current, { id: data.id, codigo: data.codigo, concepto: data.concepto, categoria: data.categoria, monto: Number(data.monto), activo: data.activo }]);
      setNewFee({ concepto: '', codigo: '', monto: '', categoria: 'general' });
      pushToast('success', 'Arancel guardado en la base de datos.');
    }
  };

  // --- BECAS ---
  const handleEditScholarshipClick = (scholarship: ScholarshipType) => {
    setEditingScholarshipId(scholarship.id);
    setNewScholarship({ nombre: scholarship.nombre, porcentaje: scholarship.porcentaje.toString(), descripcion: scholarship.descripcion || '' });
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
      const { data, error } = await supabase
        .from('tipos_beca')
        .update({ nombre: newScholarship.nombre, porcentaje_descuento: percentage, descripcion: newScholarship.descripcion || null })
        .eq('id', editingScholarshipId)
        .select('*')
        .single();

      if (error) {
        pushToast('error', 'No se pudo actualizar la beca.');
        return;
      }

      setScholarships((current) => current.map((s) => s.id === editingScholarshipId ? { ...s, nombre: data.nombre, porcentaje: Number(data.porcentaje_descuento), descripcion: data.descripcion ?? undefined } : s));
      pushToast('success', 'Beca actualizada correctamente.');
      handleCancelScholarshipEdit();
    } else {
      const { data, error } = await supabase
        .from('tipos_beca')
        .insert({ nombre: newScholarship.nombre, porcentaje_descuento: percentage, descripcion: newScholarship.descripcion || null, activo: true })
        .select('*')
        .single();

      if (error) {
        pushToast('error', 'No se pudo guardar la beca.');
        return;
      }

      setScholarships((current) => [...current, { id: data.id, nombre: data.nombre, porcentaje: Number(data.porcentaje_descuento), descripcion: data.descripcion ?? undefined, activo: data.activo }]);
      setNewScholarship({ nombre: '', porcentaje: '', descripcion: '' });
      pushToast('success', 'Beca guardada en la base de datos.');
    }
  };

  // --- MIGRACIÓN ---
  const ejecutarProcesoMigracion = async () => {
    try {
      setMigrando(true);
      setProgresoMigracion('Iniciando migración y conciliación de caja_historico...');

      const { data: historicos, error: errHist } = await supabase
        .from('caja_historico')
        .select('*')
        .not('ci', 'is', null)
        .neq('ci', '');

      if (errHist) {
        pushToast('error', 'Error al leer la tabla caja_historico.');
        setProgresoMigracion('Error al leer caja_historico.');
        return;
      }

      const totalRegistros = historicos?.length || 0;
      setProgresoMigracion(`Se encontraron ${totalRegistros} registros con CI. Procesando...`);

      let procesados = 1;
      for (const item of (historicos || [])) {
        try {
          setProgresoMigracion(`Procesando (${procesados}/${totalRegistros}) - CI: ${item.ci}`);
          procesados++;

          const { data: alumnoData, error: errAlumno } = await supabase
            .from('alumnos')
            .select('id')
            .eq('ci', item.ci)
            .eq('carrera_id', item.carrera)
            .single();

          if (errAlumno || !alumnoData) continue;

          const alumnoId = alumnoData.id;
          const importeTotal = parsearMontoBoliviano(item.importe);
          const observaciones = item.observaciones || '';
          const conceptoGeneral = item.concepto_general || '';

          const { error: errPago } = await supabase
            .from('alumnos_pagos')
            .insert({
              alumno_id: alumnoId,
              monto_pagado: importeTotal,
              canal_pago: 'EFECTIVO',
              numero_transaccion: item.recibo_factura ? String(item.recibo_factura) : null,
              fecha_pago: item.fecha ? new Date(item.fecha.split('/').reverse().join('-')).toISOString() : new Date().toISOString(),
              estado_conciliacion: 'APROBADO',
              concepto: conceptoGeneral,
              observacion: observaciones
            });

          if (errPago) continue;

          const cuotasDetectadas = extraerNumerosDeConcepto(observaciones, conceptoGeneral);
          
          if (cuotasDetectadas.length > 0) {
            for (const nroCuota of cuotasDetectadas) {
              const { data: mensualidad, error: errMens } = await supabase
                .from('alumnos_mensualidades')
                .select('id')
                .eq('alumno_id', alumnoId)
                .eq('nro_cuota', nroCuota)
                .single();

              if (!errMens && mensualidad) {
                await supabase.from('alumnos_mensualidades').update({ estado: 'PAGADO' }).eq('id', mensualidad.id);
              } else if (nroCuota === 0) {
                await supabase.from('alumnos_mensualidades').insert({
                  alumno_id: alumnoId,
                  nro_cuota: 0,
                  estado: 'PAGADO',
                  monto_original: importeTotal
                });
              }
            }
          }
        } catch (itemError) {
          console.error(itemError);
        }
      }

      setProgresoMigracion('¡Migración y conciliación finalizada con éxito!');
      pushToast('success', 'El proceso de migración finalizó correctamente.');
    } catch (error) {
      pushToast('error', 'Ocurrió un error durante la migración.');
      setProgresoMigracion('Error en la ejecución.');
    } finally {
      setMigrando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selector Principal de Secciones */}
      <div className="flex items-center gap-2 border-b pb-4">
        <button 
          className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition ${mainTab === 'catalogos' ? 'bg-navy-800 text-white shadow' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
          onClick={() => setMainTab('catalogos')}
        >
          <Database className="h-4 w-4" /> Catálogos (Aranceles, Becas y Otros)
        </button>
        <button 
          className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition ${mainTab === 'usuarios' ? 'bg-navy-800 text-white shadow' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
          onClick={() => setMainTab('usuarios')}
        >
          <Users className="h-4 w-4" /> Gestión de Usuarios y Permisos
        </button>
      </div>

      {/* VISTA 1: CATÁLOGOS */}
      {mainTab === 'catalogos' && (
        <div className="space-y-6">
          <div className="flex items-center gap-1 rounded-lg bg-ink-100 p-1 w-fit">
            <button className={`btn ${catalogSubTab === 'fees' ? 'bg-white text-navy-800 shadow-sm' : 'text-ink-500'}`} onClick={() => setCatalogSubTab('fees')}>
              <DollarSign className="h-4 w-4" /> Aranceles
            </button>
            <button className={`btn ${catalogSubTab === 'scholarships' ? 'bg-white text-navy-800 shadow-sm' : 'text-ink-500'}`} onClick={() => setCatalogSubTab('scholarships')}>
              <Award className="h-4 w-4" /> Becas
            </button>
            <button className={`btn ${catalogSubTab === 'other' ? 'bg-white text-navy-800 shadow-sm' : 'text-ink-500'}`} onClick={() => setCatalogSubTab('other')}>
              <Tag className="h-4 w-4" /> Otros
            </button>
          </div>

          {catalogSubTab === 'fees' && (
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
                          <button onClick={() => handleEditFeeClick(fee)} className="p-1.5 text-ink-400 hover:text-navy-600 hover:bg-ink-100 rounded-lg transition" title="Editar arancel">
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
                  <h3 className="font-bold text-ink-900">{editingFeeId ? 'Editar arancel seleccionado' : 'Agregar nuevo arancel'}</h3>
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

          {catalogSubTab === 'scholarships' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {scholarships.map((scholarship) => (
                  <div className="card p-5 relative flex flex-col justify-between" key={scholarship.id}>
                    <div>
                      <div className="flex items-center justify-between">
                        <Award className="h-6 w-6 text-amber-600" />
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-navy-800">{scholarship.porcentaje}%</span>
                          <button onClick={() => handleEditScholarshipClick(scholarship)} className="p-1.5 text-ink-400 hover:text-navy-600 hover:bg-ink-100 rounded-lg transition" title="Editar beca">
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
                  <h3 className="font-bold text-ink-900">{editingScholarshipId ? 'Editar tipo de beca' : 'Agregar tipo de beca'}</h3>
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

          {catalogSubTab === 'other' && (
            <div className="card p-8 space-y-6">
              <div className="flex items-center gap-3 border-b pb-4">
                <div className="h-12 w-12 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center">
                  <Database className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-ink-900">Proceso de Migración de Datos</h3>
                  <p className="text-sm text-ink-500">Herramienta dedicada para conciliar y transferir registros históricos de caja hacia el sistema actual.</p>
                </div>
              </div>

              <div className="bg-ink-50 p-5 rounded-lg border border-ink-200 space-y-4">
                <h4 className="font-semibold text-ink-800 text-sm flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-navy-600" /> Control de Migración
                </h4>
                <p className="text-xs text-ink-600">
                  Al hacer clic en el botón se leerán los registros de <code className="bg-white px-1 py-0.5 rounded border">caja_historico</code>, se asociarán con los alumnos mediante su CI y carrera, y se registrarán los pagos, matrículas y cuotas correspondientes en Supabase.
                </p>

                {progresoMigracion && (
                  <div className="p-3 bg-white border rounded-md text-xs font-mono text-navy-800 flex items-center gap-2 shadow-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <span>{progresoMigracion}</span>
                  </div>
                )}

                <button onClick={ejecutarProcesoMigracion} disabled={migrando} className="btn-primary flex items-center gap-2">
                  <UploadCloud className="h-4 w-4" />
                  {migrando ? 'Ejecutando migración...' : 'Iniciar Proceso de Migración'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VISTA 2: GESTIÓN DE USUARIOS Y PERFILES */}
      {mainTab === 'usuarios' && (
        <div className="space-y-6">
          {/* Formulario para Crear Usuario */}
          <div className="card p-6 border-2 border-dashed border-ink-200 space-y-4">
            <h3 className="font-bold text-ink-900 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-navy-600" /> Registrar Nuevo Usuario del Sistema
            </h3>
            <form onSubmit={handleCrearUsuario} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input className="input" placeholder="Nombres" value={newUser.nombres} onChange={(e) => setNewUser({ ...newUser, nombres: e.target.value })} required />
              <input className="input" placeholder="Apellidos" value={newUser.apellidos} onChange={(e) => setNewUser({ ...newUser, apellidos: e.target.value })} required />
              <input className="input" type="email" placeholder="Correo electrónico" value={newUser.correo} onChange={(e) => setNewUser({ ...newUser, correo: e.target.value })} required />
              <input className="input" type="password" placeholder="Contraseña temporal" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
              <select className="input" value={newUser.tipo_usuario} onChange={(e) => setNewUser({ ...newUser, tipo_usuario: e.target.value as any })}>
                <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
                <option value="ALUMNO">ALUMNO</option>
              </select>
              <select className="input" value={newUser.rol} onChange={(e) => setNewUser({ ...newUser, rol: e.target.value as any })}>
                <option value="ADMINISTRADOR">ADMINISTRADOR</option>
                <option value="CAJERO">CAJERO</option>
                <option value="SECRETARIA">SECRETARIA</option>
                <option value="ESTUDIANTE">ESTUDIANTE</option>
              </select>
              <input className="input" placeholder="Cédula de Identidad (CI)" value={newUser.ci} onChange={(e) => setNewUser({ ...newUser, ci: e.target.value })} />
              <input className="input" placeholder="Teléfono" value={newUser.telefono} onChange={(e) => setNewUser({ ...newUser, telefono: e.target.value })} />
              <div className="md:col-span-3 flex justify-end">
                <button type="submit" className="btn-primary flex items-center gap-2">
                  <UserPlus className="h-4 w-4" /> Crear Usuario y Perfil
                </button>
              </div>
            </form>
          </div>

          {/* Listado de Usuarios Existentes con Buscador */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-bold text-ink-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-navy-600" /> Usuarios Registrados en el Sistema
              </h3>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
                <input 
                  className="input pl-9 text-sm" 
                  placeholder="Buscar por nombre, correo o CI..." 
                  value={busquedaUsuario} 
                  onChange={(e) => setBusquedaUsuario(e.target.value)} 
                />
              </div>
            </div>

            {loadingUsuarios ? (
              <p className="text-sm text-ink-500">Cargando usuarios...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-ink-50 text-ink-700">
                      <th className="p-3">Nombre Completo</th>
                      <th className="p-3">Correo</th>
                      <th className="p-3">Tipo / Rol</th>
                      <th className="p-3">CI</th>
                      <th className="p-3">Último Acceso</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuariosFiltrados.map((u) => (
                      <tr key={u.id} className="border-b hover:bg-ink-50">
                        <td className="p-3 font-medium text-ink-900">{u.nombres} {u.apellidos}</td>
                        <td className="p-3 text-ink-600">{u.correo}</td>
                        <td className="p-3">
                          <span className="badge-gray">{u.tipo_usuario}</span>
                          <span className="block text-xs font-semibold text-navy-700 mt-0.5">{u.rol || 'N/A'}</span>
                        </td>
                        <td className="p-3 text-ink-600">{u.ci || '-'}</td>
                        <td className="p-3 text-xs font-mono text-ink-500">
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : 'Nunca'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {u.activo ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>
                        <td className="p-3 text-right flex items-center justify-end gap-1">
                          <button 
                            onClick={() => abrirModalPassword(u)} 
                            className="p-1.5 text-ink-500 hover:text-navy-600 hover:bg-ink-100 rounded transition" 
                            title="Restablecer contraseña"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => toggleActivoUsuario(u)} 
                            className={`p-1.5 rounded transition ${u.activo ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}`}
                            title={u.activo ? 'Inactivar usuario' : 'Activar usuario'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => eliminarUsuario(u)} 
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition" 
                            title="Eliminar usuario"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {usuariosFiltrados.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-ink-400">No se encontraron perfiles registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PARA RESETEAR CONTRASEÑA */}
      {modalPasswordOpen && usuarioSeleccionado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card p-6 w-full max-w-md space-y-4 bg-white shadow-xl rounded-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-ink-900 flex items-center gap-2">
                <Key className="h-5 w-5 text-navy-600" /> Restablecer Contraseña
              </h3>
              <button onClick={() => setModalPasswordOpen(false)} className="text-ink-400 hover:text-ink-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-ink-600">
              Establecer una nueva clave para el usuario: <strong className="text-ink-900">{usuarioSeleccionado.nombres} {usuarioSeleccionado.apellidos}</strong>
            </p>
            <div>
              <label className="text-xs font-semibold text-ink-700 block mb-1">Nueva Contraseña</label>
              <input 
                type="password" 
                className="input w-full" 
                placeholder="Mínimo 6 caracteres" 
                value={nuevoPassword} 
                onChange={(e) => setNuevoPassword(e.target.value)} 
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModalPasswordOpen(false)} className="btn-secondary text-sm">
                Cancelar
              </button>
              <button onClick={guardarNuevoPassword} className="btn-primary text-sm flex items-center gap-1">
                <Save className="h-4 w-4" /> Guardar Nueva Clave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}