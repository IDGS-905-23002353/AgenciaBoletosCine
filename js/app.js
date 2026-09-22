          const API_URL = 'http://localhost:5000/api';
        let temporizadorActivo = null;

        // --- 1. CARGAR CARTELERA ---
        async function cargarCartelera() {
            try {
                const res = await fetch(`${API_URL}/eventos`);
                const peliculas = await res.json();
                const grid = document.getElementById('gridPeliculas');
                grid.innerHTML = '';

                if (!peliculas || peliculas.length === 0) {
                    grid.innerHTML = '<p class="text-center text-muted">No hay películas en cartelera por el momento.</p>';
                    return;
                }

                for (let pelicula of peliculas) {
                    let badgesHorarios = '';
                    try {
                        const resHorarios = await fetch(`${API_URL}/horarios/${pelicula.id}`);
                        const horarios = await resHorarios.json();

                        if (horarios && horarios.length > 0) {
                            horarios.forEach(h => {
                                const disponibles = (h.capacidad_maxima || 50) - (h.boletos_vendidos || 0);
                                const estaAgotado = disponibles <= 0;

                                badgesHorarios += `
                                    <button class="funcion-card-btn mb-2" 
                                            onclick="seleccionarHorario(${h.id}, '${pelicula.titulo.replace(/'/g, "\\'")}', '${h.fecha}', '${h.hora}', '${h.sala}', ${disponibles})"
                                            ${estaAgotado ? 'disabled' : ''}>
                                        <div class="d-flex justify-content-between align-items-center mb-1">
                                            <span class="small text-muted"><i class="bi bi-calendar-event me-1"></i>${h.fecha}</span>
                                            <span class="badge ${estaAgotado ? 'bg-danger' : 'bg-success'} px-2 py-1">${estaAgotado ? 'Agotado' : disponibles + ' disp.'}</span>
                                        </div>
                                        <div class="d-flex justify-content-between align-items-center">
                                            <span class="fs-6 fw-bold text-info"><i class="bi bi-clock me-1"></i>${h.hora}</span>
                                            <span class="badge bg-secondary text-light border border-secondary px-2 py-1"><i class="bi bi-door-open me-1"></i>${h.sala}</span>
                                        </div>
                                    </button>`;
                            });
                        } else {
                            badgesHorarios = '<span class="text-muted small">Sin horarios disponibles</span>';
                        }
                    } catch (err) {
                        badgesHorarios = '<span class="text-danger small">Error al cargar horarios</span>';
                    }

                    grid.innerHTML += `
                        <div class="col-md-4">
                            <div class="card card-pelicula h-100 shadow-sm p-3">
                                <div class="card-body d-flex flex-column">
                                    <h4 class="card-title fw-bold text-white mb-2">${pelicula.titulo}</h4>
                                    <p class="card-text text-muted small flex-grow-1">${pelicula.descripcion || 'Sin descripción'}</p>
                                    <div class="mb-3">
                                        <span class="text-danger fw-bold fs-5">$${pelicula.precio} MXN</span>
                                    </div>
                                    <hr class="border-secondary">
                                    <p class="text-uppercase text-white small fw-bold mb-2">Funciones y Salas:</p>
                                    <div class="d-flex flex-column">${badgesHorarios}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            } catch (e) {
                console.error('Error al conectar con la API de eventos:', e);
            }
        }

        // --- 2. TEMPORIZADOR Y RESERVAS ---
        function iniciarTemporizadorRetencion() {
            let tiempo = 15; 
            const contenedor = document.getElementById('contenedorTemporizador');
            const spanContador = document.getElementById('contador');
            
            contenedor.classList.remove('d-none');
            spanContador.textContent = tiempo;

            if (temporizadorActivo) clearInterval(temporizadorActivo);

            temporizadorActivo = setInterval(() => {
                tiempo--;
                spanContador.textContent = tiempo;

                if (tiempo < 0) {
                    clearInterval(temporizadorActivo);
                    contenedor.classList.remove('border-danger');
                    contenedor.classList.add('border-warning');
                    contenedor.innerHTML = `<strong>¡Tiempo agotado!</strong> Los asientos seleccionados han sido liberados.`;
                    
                    const modalEl = document.getElementById('modalReserva');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
            }, 1000);
        }

        function seleccionarHorario(horarioId, tituloPelicula, fecha, hora, sala, disponibles) {
            if (disponibles <= 0) {
                alert('Lo sentimos, esta función está agotada.');
                return;
            }

            document.getElementById('horarioSeleccionadoId').value = horarioId;
            document.getElementById('detallesPelículaTitulo').textContent = tituloPelicula;
            document.getElementById('detallesFecha').textContent = fecha;
            document.getElementById('detallesHora').textContent = hora;
            document.getElementById('detallesSala').textContent = sala;
            document.getElementById('detallesDisponibles').textContent = disponibles;
            
            const inputCantidad = document.getElementById('cantidadBoletos');
            inputCantidad.max = disponibles;
            inputCantidad.value = 1; 
            
            const modalReserva = new bootstrap.Modal(document.getElementById('modalReserva'));
            modalReserva.show();

            iniciarTemporizadorRetencion();
        }

        document.getElementById('formReservaBoleto').addEventListener('submit', async function(e) {
            e.preventDefault();
            const datos = {
                horario_id: document.getElementById('horarioSeleccionadoId').value,
                nombre_cliente: document.getElementById('nombreCliente').value,
                cantidad_boletos: parseInt(document.getElementById('cantidadBoletos').value)
            };

            try {
                const res = await fetch(`${API_URL}/reservas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datos)
                });
                const resultado = await res.json();
                const alerta = document.getElementById('alertaRespuesta');

                if (res.ok) {
                    alerta.innerHTML = `<div class="alert alert-success">${resultado.mensaje || '¡Boleto reservado con éxito!'}</div>`;
                    if (temporizadorActivo) clearInterval(temporizadorActivo);
                    setTimeout(() => { location.reload(); }, 2000);
                } else {
                    alerta.innerHTML = `<div class="alert alert-danger">${resultado.error || 'Error al procesar'}</div>`;
                }
            } catch (e) { console.error(e); }
        });

        // --- 3. PANEL ADMIN CRUD CON EDICIÓN Y CREACIÓN DE HORARIOS ---
        async function cargarAdminPeliculas() {
            try {
                const res = await fetch(`${API_URL}/eventos`);
                const peliculas = await res.json();
                const tbody = document.getElementById('tablaAdminBody');
                tbody.innerHTML = '';

                peliculas.forEach(p => {
                    tbody.innerHTML += `
                        <tr>
                            <td>${p.id}</td>
                            <td class="fw-bold text-white">${p.titulo}</td>
                            <td class="text-muted small">${p.descripcion || ''}</td>
                            <td>$${p.precio}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-warning me-1" title="Editar Película y Horarios" onclick="abrirEditar(${p.id}, '${p.titulo.replace(/'/g, "\\'")}', '${(p.descripcion || '').replace(/'/g, "\\'")}', ${p.precio})"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-outline-danger" title="Eliminar Película" onclick="eliminarPelicula(${p.id})"><i class="bi bi-trash"></i></button>
                            </td>
                        </tr>
                    `;
                });
            } catch (e) { console.error(e); }
        }

        function prepararCreacion() {
            document.getElementById('modalCrudTitulo').textContent = 'Crear Nueva Película';
            document.getElementById('seccionHorariosTitulo').textContent = 'Función Inicial:';
            document.getElementById('btnAgregarHorarioExtra').style.display = 'none'; // Ocultar botón extra al crear
            document.getElementById('peliculaId').value = '';
            document.getElementById('formCrudPelicula').reset();

            // Formulario estándar para crear 1 función inicial
            document.getElementById('contenedorHorariosDinamicos').innerHTML = `
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-light small">Fecha</label>
                        <input type="date" class="form-control" id="inputFecha" required>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-light small">Hora (Ej. 16:30 hrs)</label>
                        <input type="text" class="form-control" id="inputHora" placeholder="16:30 hrs" required>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-light small">Sala</label>
                        <input type="text" class="form-control" id="inputSala" placeholder="Sala 1 - VIP" required>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label text-light small">Capacidad Máxima</label>
                        <input type="number" class="form-control" id="inputCapacidad" value="50" required>
                    </div>
                </div>
            `;
        }

        async function abrirEditar(id, titulo, descripcion, precio) {
            document.getElementById('modalCrudTitulo').textContent = 'Editar Película y Horarios';
            document.getElementById('seccionHorariosTitulo').textContent = 'Funciones Existentes:';
            document.getElementById('btnAgregarHorarioExtra').style.display = 'inline-block'; // Mostrar botón para agregar más horarios
            document.getElementById('peliculaId').value = id;
            document.getElementById('inputTitulo').value = titulo;
            document.getElementById('inputDescripcion').value = descripcion;
            document.getElementById('inputPrecio').value = precio;

            const contenedorHorarios = document.getElementById('contenedorHorariosDinamicos');
            contenedorHorarios.innerHTML = '<p class="text-muted small">Cargando horarios...</p>';

            try {
                const resHorarios = await fetch(`${API_URL}/horarios/${id}`);
                const horarios = await resHorarios.json();

                contenedorHorarios.innerHTML = '';
                if (horarios && horarios.length > 0) {
                    horarios.forEach((h, index) => {
                        contenedorHorarios.innerHTML += `
                            <div class="p-3 mb-3 bg-secondary bg-opacity-10 border border-secondary rounded-3 horario-item" data-horario-id="${h.id}">
                                <p class="text-info small fw-bold mb-2">Función #${index + 1} (Modificable)</p>
                                <div class="row">
                                    <div class="col-md-6 mb-2">
                                        <label class="form-label text-light small">Fecha</label>
                                        <input type="date" class="form-control input-fecha" value="${h.fecha}" required>
                                    </div>
                                    <div class="col-md-6 mb-2">
                                        <label class="form-label text-light small">Hora</label>
                                        <input type="text" class="form-control input-hora" value="${h.hora}" required>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <label class="form-label text-light small">Sala</label>
                                        <input type="text" class="form-control input-sala" value="${h.sala}" required>
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label text-light small">Capacidad Máxima</label>
                                        <input type="number" class="form-control input-capacidad" value="${h.capacidad_maxima}" required>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                } else {
                    contenedorHorarios.innerHTML = '<p class="text-warning small">Esta película no tiene funciones registradas. Agrega una nueva función abajo.</p>';
                }
            } catch (err) {
                contenedorHorarios.innerHTML = '<p class="text-danger small">Error al cargar los horarios.</p>';
            }

            const modal = new bootstrap.Modal(document.getElementById('modalPelicula'));
            modal.show();
        }

        // Función para agregar un bloque extra de horario vacío al editar
        function agregarCampoHorarioExtra() {
            const contenedorHorarios = document.getElementById('contenedorHorariosDinamicos');
            contenedorHorarios.innerHTML += `
                <div class="p-3 mb-3 bg-success bg-opacity-10 border border-success rounded-3 horario-nuevo" data-horario-id="nuevo">
                    <p class="text-success small fw-bold mb-2"><i class="bi bi-plus-circle me-1"></i>Nueva Función a Agregar</p>
                    <div class="row">
                        <div class="col-md-6 mb-2">
                            <label class="form-label text-light small">Fecha</label>
                            <input type="date" class="form-control input-nuevo-fecha" required>
                        </div>
                        <div class="col-md-6 mb-2">
                            <label class="form-label text-light small">Hora</label>
                            <input type="text" class="form-control input-nuevo-hora" placeholder="20:00 hrs" required>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <label class="form-label text-light small">Sala</label>
                            <input type="text" class="form-control input-nuevo-sala" placeholder="Sala 3 - IMAX" required>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label text-light small">Capacidad Máxima</label>
                            <input type="number" class="form-control input-nuevo-capacidad" value="50" required>
                        </div>
                    </div>
                </div>
            `;
        }

        // Envío unificado para Crear (POST) o Actualizar Película, modificar horarios existentes y crear nuevos
        document.getElementById('formCrudPelicula').addEventListener('submit', async function(e) {
            e.preventDefault();
            const id = document.getElementById('peliculaId').value;
            
            if (!id) {
                // MODO CREAR
                const datos = {
                    titulo: document.getElementById('inputTitulo').value,
                    descripcion: document.getElementById('inputDescripcion').value,
                    precio: parseFloat(document.getElementById('inputPrecio').value),
                    fecha: document.getElementById('inputFecha').value,
                    hora: document.getElementById('inputHora').value,
                    sala: document.getElementById('inputSala').value,
                    capacidad_maxima: parseInt(document.getElementById('inputCapacidad').value)
                };

                const res = await fetch(`${API_URL}/eventos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datos)
                });
                if (res.ok) location.reload();
                else alert('Error al crear la película');

            } else {
                // MODO EDITAR: Actualiza datos generales de la película
                const datosPelicula = {
                    titulo: document.getElementById('inputTitulo').value,
                    descripcion: document.getElementById('inputDescripcion').value,
                    precio: parseFloat(document.getElementById('inputPrecio').value)
                };

                const resPeli = await fetch(`${API_URL}/eventos/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datosPelicula)
                });

                // 1. Actualizar los horarios existentes modificados
                const itemsHorarios = document.querySelectorAll('.horario-item');
                for (let item of itemsHorarios) {
                    const horarioId = item.getAttribute('data-horario-id');
                    const datosHorario = {
                        fecha: item.querySelector('.input-fecha').value,
                        hora: item.querySelector('.input-hora').value,
                        sala: item.querySelector('.input-sala').value,
                        capacidad_maxima: parseInt(item.querySelector('.input-capacidad').value)
                    };

                    await fetch(`${API_URL}/horarios/${horarioId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(datosHorario)
                    });
                }

                // 2. Guardar los nuevos horarios que el usuario decidió agregar en este momento
                const itemsNuevos = document.querySelectorAll('.horario-nuevo');
                for (let nuevo of itemsNuevos) {
                    const datosNuevoHorario = {
                        evento_id: id,
                        fecha: nuevo.querySelector('.input-nuevo-fecha').value,
                        hora: nuevo.querySelector('.input-nuevo-hora').value,
                        sala: nuevo.querySelector('.input-nuevo-sala').value,
                        capacidad_maxima: parseInt(nuevo.querySelector('.input-nuevo-capacidad').value)
                    };

                    await fetch(`${API_URL}/horarios`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(datosNuevoHorario)
                    });
                }

                if (resPeli.ok) {
                    location.reload();
                } else {
                    alert('Error al actualizar la película');
                }
            }
        });

        async function eliminarPelicula(id) {
            if (confirm('¿Estás seguro de eliminar esta película y sus funciones?')) {
                try {
                    const res = await fetch(`${API_URL}/eventos/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        cargarAdminPeliculas();
                        cargarCartelera();
                    }
                } catch (e) { console.error(e); }
            }
        }

      
        cargarCartelera();
        cargarAdminPeliculas();
 