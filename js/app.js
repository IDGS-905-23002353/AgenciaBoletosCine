        // ---------- Registro del Service Worker (código de clase) ----------
        if ("serviceWorker" in navigator) {
            window.addEventListener("load", async () => {
                try {
                    const registro = await navigator.serviceWorker.register("./service-worker.js");
                    console.log("Service Worker registrado correctamente:", registro.scope);
                } catch (error) {
                    console.error("Error al registrar Service Worker:", error);
                }
            });
        }

          const API_URL = 'http://localhost:5000/api';
        let temporizadorActivo = null;
        const IVA = 0.16;
        let peliculas = [];          // Lista de películas cargadas, para buscarlas con find()
        let precioSeleccionado = 0;  // Precio de la película de la función elegida

        // Arrow functions (appArrow.js)
        const calcularDisponibles = (h) => (h.capacidad_maxima || 50) - (h.boletos_vendidos || 0) - (h.boletos_apartados || 0);

        // Igual que en app.js: el precio ya incluye IVA, así que calculamos cuánto IVA se cobró
        const desglosarIVA = (total) => {
            const subtotal = total / (1 + IVA);
            const ivaTotal = total - subtotal;
            return { subtotal, ivaTotal, total };
        };

        // Promesa (appPrometida.js): se resuelve si la cantidad es válida y se rechaza si no
        const validarCantidad = (cantidad, disponibles) => new Promise((resolve, reject) => {
            if (cantidad > 0 && cantidad <= disponibles) {
                resolve(cantidad);
            } else {
                reject(`Solo puedes reservar entre 1 y ${disponibles} boletos.`);
            }
        });

        // Promesa que se resuelve después de "ms" milisegundos (setTimeout dentro de una Promesa)
        const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        // Promesa para convertir la imagen seleccionada a Base64
        const convertirBase64 = (archivo) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(archivo);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        };

        // CARGAR CARTELERA
        const cargarCartelera = async () => {
            try {
                const res = await fetch(`${API_URL}/eventos`);
                peliculas = await res.json();
                const grid = document.getElementById('gridPeliculas');
                grid.innerHTML = '';

                if (!peliculas || peliculas.length === 0) {
                    grid.innerHTML = '<p class="text-center text-muted">No hay películas en cartelera por el momento.</p>';
                    return;
                }

                for (let pelicula of peliculas) {
                    let badgesHorarios = '';
                    let resumenFunciones = '';
                    try {
                        const resHorarios = await fetch(`${API_URL}/horarios/${pelicula.id}`);
                        const horarios = await resHorarios.json();

                        if (horarios && horarios.length > 0) {
                            // filter: funciones con lugares / reduce: suma de asientos libres / some: ¿queda alguna?
                            const conLugares = horarios.filter(h => calcularDisponibles(h) > 0);
                            const asientosLibres = conLugares.reduce((acumulador, h) => acumulador + calcularDisponibles(h), 0);
                            const hayLugares = horarios.some(h => calcularDisponibles(h) > 0);
                            resumenFunciones = hayLugares
                                ? ` (${conLugares.length} de ${horarios.length} con lugares, ${asientosLibres} asientos libres)`
                                : ' (Agotada)';

                            // map: convierte cada horario en su botón y join los une en un solo texto
                            badgesHorarios = horarios.map(h => {
                                const disponibles = calcularDisponibles(h);
                                const estaAgotado = disponibles <= 0;

                                return `
                                    <button class="funcion-card-btn mb-2"
                                            onclick="seleccionarHorario(${h.id}, '${pelicula.titulo.replace(/'/g, "\\'")}', '${h.fecha}', '${h.hora}', '${h.sala}', ${disponibles}, ${pelicula.id})"
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
                            }).join('');
                        } else {
                            badgesHorarios = '<span class="text-muted small">Sin horarios disponibles</span>';
                        }
                    } catch (err) {
                        badgesHorarios = '<span class="text-danger small">Error al cargar horarios</span>';
                    }

                    // Modificación: Se añade la etiqueta <img> para mostrar la imagen en Base64 guardada en la BD
                    grid.innerHTML += `
                <div class="col-md-4 mb-4">
                    <div class="card card-pelicula h-100 shadow-sm p-3">
                        <img src="${pelicula.imagen_base64 || ''}" class="card-img-top rounded-3 mb-2" alt="${pelicula.titulo}" style="height: 160px; object-fit: cover;">            
                        <div class="card-body d-flex flex-column p-0">
                            <h4 class="card-title fw-bold text-white mb-2">${pelicula.titulo}</h4>
                            <p class="card-text text-muted small flex-grow-1">${pelicula.descripcion || 'Sin descripción'}</p>
                            <div class="mb-3">
                                <span class="text-danger fw-bold fs-5">$${pelicula.precio} MXN</span>
                            </div>
                            <hr class="border-secondary">
                            <p class="text-muted small mb-2"><i class="bi bi-info-circle me-1"></i>${resumenFunciones}</p>
                            <button class="btn btn-primary w-100 mt-auto" onclick="abrirModalHorarios(${pelicula.id})">
                                <i class="bi bi-ticket-perforated me-1"></i> Reservar boletos
                            </button>
                        </div>
                    </div>
                </div>
            `;
                }
            } catch (e) {
                console.error('Error al conectar con la API de eventos:', e);
            }
        };

        // --- Función para mostrar el paso de apartado ---
        // false = eligiendo cantidad (botón Apartar), true = boletos apartados (botón Confirmar y temporizador)
        const mostrarPasoApartado = (apartado) => {
            document.getElementById('btnApartar').classList.toggle('d-none', apartado);
            document.getElementById('btnConfirmar').classList.toggle('d-none', !apartado);
            document.getElementById('contenedorTemporizador').classList.toggle('d-none', !apartado);
            document.getElementById('cantidadBoletos').disabled = apartado;
        };



        const seleccionarHorario = (horarioId, tituloPelicula, fecha, hora, sala, disponibles, peliculaId) => {
            if (disponibles <= 0) {
                alert('Lo sentimos, esta función está agotada.');
                return;
            }

            // find + destructuración (hola.js): tomamos el precio de la película elegida
            const { precio } = peliculas.find(p => p.id === peliculaId);
            precioSeleccionado = precio;

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

            if (temporizadorActivo) clearInterval(temporizadorActivo);
            mostrarPasoApartado(false);
            document.getElementById('alertaRespuesta').innerHTML = '';
            generarMapaAsientos();
        };

        // Función para abrir el modal que lista los horarios disponibles de una película
const abrirModalHorarios = async (peliculaId) => {
    const pelicula = peliculas.find(p => p.id === peliculaId);
    if (!pelicula) return;

    document.getElementById('modalHorariosTituloPelicula').textContent = pelicula.titulo;
    const contenedorLista = document.getElementById('listaHorariosModal');
    contenedorLista.innerHTML = '<p class="text-muted text-center">Cargando funciones...</p>';

    // Mostramos el modal de horarios (asegúrate de tener este modal en tu HTML)
    const modalHorariosEl = document.getElementById('modalHorarios');
    const modalHorarios = new bootstrap.Modal(modalHorariosEl);
    modalHorarios.show();

    try {
        const resHorarios = await fetch(`${API_URL}/horarios/${peliculaId}`);
        const horarios = await resHorarios.json();

        contenedorLista.innerHTML = '';

        if (horarios && horarios.length > 0) {
            horarios.forEach(h => {
                const disponibles = calcularDisponibles(h);
                const estaAgotado = disponibles <= 0;

                contenedorLista.innerHTML += `
                    <button class="funcion-card-btn mb-2 w-100 text-start p-3 bg-dark border border-secondary rounded"
                            onclick="cerrarModalYSeleccionar(${h.id}, '${pelicula.titulo.replace(/'/g, "\\'")}', '${h.fecha}', '${h.hora}', '${h.sala}', ${disponibles}, ${pelicula.id})"
                            ${estaAgotado ? 'disabled' : ''}>
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="small text-muted"><i class="bi bi-calendar-event me-1"></i>${h.fecha}</span>
                            <span class="badge ${estaAgotado ? 'bg-danger' : 'bg-success'} px-2 py-1">${estaAgotado ? 'Agotado' : disponibles + ' disp.'}</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="fs-6 fw-bold text-info"><i class="bi bi-clock me-1"></i>${h.hora}</span>
                            <span class="badge bg-secondary text-light border border-secondary px-2 py-1"><i class="bi bi-door-open me-1"></i>${h.sala}</span>
                        </div>
                    </button>
                `;
            });
        } else {
            contenedorLista.innerHTML = '<p class="text-muted text-center">No hay funciones disponibles para esta película.</p>';
        }
    } catch (err) {
        contenedorLista.innerHTML = '<p class="text-danger text-center">Error al cargar los horarios.</p>';
    }
};

        // Función auxiliar para cerrar el modal de horarios y abrir de inmediato el modal de reserva/compra que ya tenías
        const cerrarModalYSeleccionar = (horarioId, tituloPelicula, fecha, hora, sala, disponibles, peliculaId) => {
            const modalHorariosEl = document.getElementById('modalHorarios');
            const modalHorariosInstance = bootstrap.Modal.getInstance(modalHorariosEl);
            if (modalHorariosInstance) {
                modalHorariosInstance.hide();
            }
            // Llamamos a tu función original para gestionar la selección de asientos/boletos
            seleccionarHorario(horarioId, tituloPelicula, fecha, hora, sala, disponibles, peliculaId);
        };


let asientosOcupadosGlobales = JSON.parse(localStorage.getItem("asientosOcupados")) || ["A-3", "B-5", "C-2", "D-7"];
let asientosSeleccionados = [];

function generarMapaAsientos() {
    const contenedorGrid = document.getElementById("gridAsientos");
    if (!contenedorGrid) return;
    contenedorGrid.innerHTML = "";

    const filas = ['A', 'B', 'C', 'D'];
    const columnasPorFila = 8;

    filas.forEach(letraFila => {
        const filaDiv = document.createElement("div");
        filaDiv.className = "d-flex gap-2 align-items-center mb-2";

        // Etiqueta de la fila (Ej. A, B, C...)
        const etiquetaFila = document.createElement("span");
        etiquetaFila.className = "text-muted fw-bold small me-2";
        etiquetaFila.style.width = "20px";
        etiquetaFila.innerText = letraFila;
        filaDiv.appendChild(etiquetaFila);

        for (let i = 1; i <= columnasPorFila; i++) {
            const idAsiento = `${letraFila}-${i}`;
            const btnAsiento = document.createElement("button");
            btnAsiento.type = "button";
            btnAsiento.innerText = i;
            btnAsiento.style.width = "32px";
            btnAsiento.style.height = "32px";
            btnAsiento.style.fontSize = "0.75rem";

            
            btnAsiento.className = "btn btn-sm p-0 rounded";

            if (asientosOcupadosGlobales.includes(idAsiento)) {
                // Estado: Ocupado (Gris y deshabilitado)
                btnAsiento.classList.add("btn-secondary", "disabled");
                btnAsiento.disabled = true;
                btnAsiento.onclick = null;
            } else if (asientosSeleccionados.includes(idAsiento)) {
                // Estado: Seleccionado por el usuario (Rojo)
                btnAsiento.classList.add("btn-danger", "text-white", "fw-bold");
                btnAsiento.disabled = false;
                btnAsiento.onclick = () => alternarSeleccionAsiento(idAsiento);
            } else {
                // Estado: Disponible (Contorno verde)
                btnAsiento.classList.add("btn-outline-success");
                btnAsiento.disabled = false;
                btnAsiento.onclick = () => alternarSeleccionAsiento(idAsiento);
            }

            filaDiv.appendChild(btnAsiento);
        }

        contenedorGrid.appendChild(filaDiv);
    });
}

function alternarSeleccionAsiento(idAsiento) {
    const index = asientosSeleccionados.indexOf(idAsiento);
    if (index > -1) {
        asientosSeleccionados.splice(index, 1);
    } else {
        asientosSeleccionados.push(idAsiento);
        
        // Si es la primera selección, iniciamos el temporizador
        if (asientosSeleccionados.length === 1) {
            iniciarTemporizadorRetencion(30); 
        }
    }

    // Si deseleccionó todos, detenemos el temporizador
    if (asientosSeleccionados.length === 0 && temporizadorActivo) {
        clearInterval(temporizadorActivo);
        temporizadorActivo = null;
    }

    actualizarResumenAsientos();
    generarMapaAsientos(); 
}

// function actualizarResumenAsientos() {
//     const contenedorLista = document.getElementById("listaAsientosSeleccionados");
//     const contadorVisual = document.getElementById("contadorBoletosVisual");
//     const inputCantidadOculto = document.getElementById("cantidadBoletos");

//     if (contadorVisual) contadorVisual.innerText = asientosSeleccionados.length;
//     if (inputCantidadOculto) inputCantidadOculto.value = asientosSeleccionados.length;

//     if (contenedorLista) {
//         if (asientosSeleccionados.length === 0) {
//             contenedorLista.innerHTML = `<span class="text-muted italic small">Ningún asiento seleccionado</span>`;
//         } else {
//             contenedorLista.innerHTML = asientosSeleccionados
//                 .map(asiento => `<span class="badge bg-danger text-white me-1">${asiento}</span>`)
//                 .join(' ');
//         }
//     }
// }

function actualizarResumenAsientos() {
    const contenedorLista = document.getElementById("listaAsientosSeleccionados");
    const contadorVisual = document.getElementById("contadorBoletosVisual");
    const inputCantidadOculto = document.getElementById("cantidadBoletos");
    const contenedorPrecios = document.getElementById("desglosePrecios"); // Contenedor de precios

    const cantidad = asientosSeleccionados.length;

    if (contadorVisual) contadorVisual.innerText = cantidad;
    if (inputCantidadOculto) inputCantidadOculto.value = cantidad;

    if (contenedorLista) {
        if (cantidad === 0) {
            contenedorLista.innerHTML = `<span class="text-muted italic small">Ningún asiento seleccionado</span>`;
        } else {
            contenedorLista.innerHTML = asientosSeleccionados
                .map(asiento => `<span class="badge bg-danger text-white me-1">${asiento}</span>`)
                .join(' ');
        }
    }

    // Lógica dinámica para actualizar subtotal y total
    if (contenedorPrecios) {
        const totalCalculado = cantidad * precioSeleccionado;
        const { subtotal, ivaTotal, total } = desglosarIVA(totalCalculado);

        contenedorPrecios.innerHTML = `
            <div class="text-muted">Subtotal: $${subtotal.toFixed(2)}</div>
            <div class="text-muted">IVA (16%): $${ivaTotal.toFixed(2)}</div>
            <div class="fw-bold text-dark mt-1 border-top pt-1">Total: $${total.toFixed(2)}</div>
        `;
    }
}

// Función de temporizador
const iniciarTemporizadorRetencion = (segundos) => {
    let tiempo = segundos;
    const spanContador = document.getElementById('contador');
    if (spanContador) spanContador.textContent = tiempo;

    if (temporizadorActivo) clearInterval(temporizadorActivo);

    temporizadorActivo = setInterval(() => {
        tiempo--;
        if (spanContador) spanContador.textContent = tiempo;

        if (tiempo <= 0) {
            clearInterval(temporizadorActivo);
            temporizadorActivo = null;
            
            // Liberamos los asientos al agotarse el tiempo
            asientosSeleccionados = [];
            actualizarResumenAsientos();
            generarMapaAsientos();

            if (typeof mostrarPasoApartado === 'function') {
                mostrarPasoApartado(false);
            }
            
            const alerta = document.getElementById('alertaRespuesta');
            if (alerta) {
                alerta.innerHTML = `<div class="alert alert-warning">¡Tiempo agotado! Los boletos volvieron a quedar disponibles.</div>`;
            }
        }
    }, 1000);
};

function confirmarPagoAsientos() {
    if (asientosSeleccionados.length === 0) {
        alert("No hay asientos seleccionados para pagar.");
        return;
    }

   
    if (temporizadorActivo) {
        clearInterval(temporizadorActivo);
        temporizadorActivo = null;
    }

    // Copiamos temporalmente los asientos que se acaban de comprar para mostrarlos en el modal
    const asientosComprados = [...asientosSeleccionados];

    asientosOcupadosGlobales.push(...asientosComprados);


    localStorage.setItem("asientosOcupados", JSON.stringify(asientosOcupadosGlobales));

    asientosSeleccionados = [];
    
    actualizarResumenAsientos();
    generarMapaAsientos();

    // Generamos un código aleatorio para la reserva (ejemplo: CINE-1234)
    const codigoAleatorio = "CINE-" + Math.floor(1000 + Math.random() * 9000);

    
    document.getElementById("codigoReservaTexto").innerText = codigoAleatorio;
    
    const contenedorModalAsientos = document.getElementById("asientosCompradosLista");
    contenedorModalAsientos.innerHTML = asientosComprados
        .map(asiento => `<span class="badge bg-secondary fs-6">${asiento}</span>`)
        .join(' ');


    const modalAsientosElement = document.getElementById('modalReserva'); 
    if (modalAsientosElement) {
        const modalAsientosBs = bootstrap.Modal.getInstance(modalAsientosElement) || new bootstrap.Modal(modalAsientosElement);
        modalAsientosBs.hide();
    }

    const modalElement = document.getElementById('modalTicket');
    const modalBootstrap = new bootstrap.Modal(modalElement);
    modalBootstrap.show();
}

        // Paso 1: apartar los boletos en el servidor para que nadie más los compre
        const apartarBoletos = async () => {
            const alerta = document.getElementById('alertaRespuesta');
            const cantidad = parseInt(document.getElementById('cantidadBoletos').value);
            const disponibles = parseInt(document.getElementById('detallesDisponibles').textContent);

            // Promesa con then/catch: si la cantidad no es válida, mostramos el motivo y no enviamos nada
            const cantidadValida = await validarCantidad(cantidad, disponibles)
                .then(() => true)
                .catch((error) => {
                    alerta.innerHTML = `<div class="alert alert-danger">${error}</div>`;
                    return false;
                });
            if (!cantidadValida) return;

            try {
                const res = await fetch(`${API_URL}/apartados`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        horario_id: document.getElementById('horarioSeleccionadoId').value,
                        cantidad_boletos: cantidad
                    })
                });
                const { apartado_id, segundos, error } = await res.json();

                if (!res.ok) {
                    alerta.innerHTML = `<div class="alert alert-danger">${error || 'Error al apartar'}</div>`;
                    cargarCartelera();
                    return;
                }

                document.getElementById('apartadoId').value = apartado_id;
                alerta.innerHTML = '';
                mostrarPasoApartado(true);
                iniciarTemporizadorRetencion(segundos);
                cargarCartelera();
            } catch (e) { console.error(e); }
        };

        // Paso 2: confirmar la compra del apartado
        document.getElementById('formReservaBoleto').addEventListener('submit', async (e) => {
            e.preventDefault();
            const datos = {
                apartado_id: document.getElementById('apartadoId').value,
                horario_id: document.getElementById('horarioSeleccionadoId').value,
                nombre_cliente: document.getElementById('nombreCliente').value,
                cantidad_boletos: parseInt(document.getElementById('cantidadBoletos').value)
            };
            const alerta = document.getElementById('alertaRespuesta');

            try {
                const res = await fetch(`${API_URL}/reservas`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datos)
                });
                const resultado = await res.json();
                // Destructuración renombrando "error" a "mensajeError"
                const { mensaje, error: mensajeError } = resultado;

                if (res.ok) {
                    const { subtotal, ivaTotal, total } = desglosarIVA(precioSeleccionado * datos.cantidad_boletos);
                    alerta.innerHTML = `<div class="alert alert-success">${mensaje || '¡Boleto reservado con éxito!'}
                        <hr class="my-2">
                        Subtotal: $${subtotal.toFixed(2)}<br>
                        IVA (16%): $${ivaTotal.toFixed(2)}<br>
                        <strong>Total a pagar: $${total.toFixed(2)}</strong></div>`;
                    if (temporizadorActivo) clearInterval(temporizadorActivo);
                    // Compra terminada: quitamos el aviso de apartado y el botón de confirmar
                    document.getElementById('contenedorTemporizador').classList.add('d-none');
                    document.getElementById('btnConfirmar').classList.add('d-none');
                    cargarCartelera();
                    // esperar(2000).then(() => location.reload());
                } else {
                    alerta.innerHTML = `<div class="alert alert-danger">${mensajeError || 'Error al procesar'}</div>`;
                    // Por ejemplo, el apartado ya expiró: volvemos al paso de apartar
                    if (temporizadorActivo) clearInterval(temporizadorActivo);
                    mostrarPasoApartado(false);
                    cargarCartelera();
                }
            } catch (e) { console.error(e); }
        });

        // --- Cargar Películas para el Panel Admin ---
        const cargarAdminPeliculas = async () => {
            try {
                const res = await fetch(`${API_URL}/eventos`);
                peliculas = await res.json();
                console.log("Datos cargados en peliculas:", peliculas); // Añade esto para depurar
                const tbody = document.getElementById('tablaAdminBody');
                tbody.innerHTML = '';

                peliculas.forEach(p => {
                    const { id, titulo, descripcion, precio } = p;
                    // createElement + appendChild en lugar de ir sumando texto con innerHTML +=
                    const fila = document.createElement('tr');
                    fila.innerHTML = `
                            <td>${id}</td>
                            <td class="fw-bold text-white">${titulo}</td>
                            <td class="text-muted small">${descripcion || ''}</td>
                            <td>$${precio}</td>
                            <td>
                                <button class="btn btn-sm btn-outline-warning me-1" title="Editar Película y Horarios" onclick="abrirEditar(${id})"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-outline-danger" title="Eliminar Película" onclick="eliminarPelicula(${id})"><i class="bi bi-trash"></i></button>
                            </td>
                    `;
                    tbody.appendChild(fila);
                });
            } catch (e) { console.error(e); }
        };

        const prepararCreacion = () => {
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
        };

        const abrirEditar = async (id) => {
            // find: buscamos la película por su id y sacamos sus datos con destructuración
            const { titulo, descripcion, precio } = peliculas.find(p => p.id === id);

            document.getElementById('modalCrudTitulo').textContent = 'Editar Película y Horarios';
            document.getElementById('seccionHorariosTitulo').textContent = 'Funciones Existentes:';
            document.getElementById('btnAgregarHorarioExtra').style.display = 'inline-block'; // Mostrar botón para agregar más horarios
            document.getElementById('peliculaId').value = id;
            document.getElementById('inputTitulo').value = titulo;
            document.getElementById('inputDescripcion').value = descripcion || '';
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
        };

        // Función para agregar un bloque extra de horario vacío al editar
        const agregarCampoHorarioExtra = () => {
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
        };

        

 // Envío unificado para Crear o Actualizar Película (MODIFICADO para enviar la imagen Base64)
        document.getElementById('formCrudPelicula').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('peliculaId').value;
            
            // Capturar archivo de imagen y transformarlo a Base64 si el usuario seleccionó uno
            const inputArchivo = document.getElementById('inputImagen');
            let imagenBase64 = '';
            if (inputArchivo && inputArchivo.files[0]) {
                try {
                    imagenBase64 = await convertirBase64(inputArchivo.files[0]);
                } catch (err) {
                    console.error("Error al convertir la imagen:", err);
                }
            }
            
            if (!id) {
                // MODO CREAR
                const datos = {
                    titulo: document.getElementById('inputTitulo').value,
                    descripcion: document.getElementById('inputDescripcion').value,
                    precio: parseFloat(document.getElementById('inputPrecio').value),
                    imagen_base64: imagenBase64, // Enviamos el Base64
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
                // MODO EDITAR
                const datosPelicula = {
                    titulo: document.getElementById('inputTitulo').value,
                    descripcion: document.getElementById('inputDescripcion').value,
                    precio: parseFloat(document.getElementById('inputPrecio').value)
                };

                // Si seleccionaron una nueva imagen al editar, la mandamos también
                if (imagenBase64) {
                    datosPelicula.imagen_base64 = imagenBase64;
                }

                const resPeli = await fetch(`${API_URL}/eventos/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datosPelicula)
                });

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

        const eliminarPelicula = async (id) => {
            if (!navigator.onLine) {
                alert('Sin conexión: para eliminar una película necesitas internet.');
                return;
            }
            if (confirm('¿Estás seguro de eliminar esta película y sus funciones?')) {
                try {
                    const res = await fetch(`${API_URL}/eventos/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        cargarAdminPeliculas();
                        cargarCartelera();
                    }
                } catch (e) { console.error(e); }
            }
        };


        // ---------- Detección de conexión (navigator.onLine) ----------
        const actualizarRed = () => {
            const enLinea = navigator.onLine;
            document.getElementById('bannerOffline').classList.toggle('d-none', enLinea);
            // Apartar, comprar y guardar en el admin necesitan al servidor
            document.querySelectorAll('#btnApartar, #btnConfirmar, #formCrudPelicula button[type="submit"]')
                .forEach((boton) => { boton.disabled = !enLinea; });
        };

        window.addEventListener('online', actualizarRed);
        window.addEventListener('online', () => cargarCartelera());  // al volver el internet se actualiza la cartelera
        window.addEventListener('offline', actualizarRed);

        cargarCartelera();
        cargarAdminPeliculas();
        actualizarRed();
        generarMapaAsientos()
        
 