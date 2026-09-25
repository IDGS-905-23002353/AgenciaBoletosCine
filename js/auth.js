// URL base de tu API en Flask
const API_URL = 'http://localhost:5000/api';

// Elementos del DOM
const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const btnShowRegister = document.getElementById('btn-show-register');
const btnShowLogin = document.getElementById('btn-show-login');

const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');

// Alternar entre vistas
btnShowRegister.addEventListener('click', () => {
    loginSection.style.display = 'none';
    registerSection.style.display = 'block';
});

btnShowLogin.addEventListener('click', () => {
    registerSection.style.display = 'none';
    loginSection.style.display = 'block';
});

// Manejo del Registro
formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;

    try {
        const response = await fetch(`${API_URL}/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: '¡Registro exitoso!',
                text: data.msg,
                confirmButtonColor: '#dc2626'
            }).then(() => {
                btnShowLogin.click(); // Vuelve a la pantalla de login automáticamente
                formRegister.reset();
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: data.msg,
                confirmButtonColor: '#dc2626'
            });
        }
    } catch (error) {
        console.error('Error en el registro:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo conectar con el servidor.',
            confirmButtonColor: '#dc2626'
        });
    }
});

// Manejo del Login
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // Guardar el JWT en localStorage
            localStorage.setItem('token', data.access_token);
            
            Swal.fire({
                icon: 'success',
                title: '¡Bienvenido!',
                text: 'Sesión iniciada correctamente',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                // Redirigir a la página principal de compra de boletos
                window.location.href = 'index.html';
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Acceso denegado',
                text: data.msg,
                confirmButtonColor: '#dc2626'
            });
        }
    } catch (error) {
        console.error('Error en el login:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudo conectar con el servidor.',
            confirmButtonColor: '#dc2626'
        });
    }
});