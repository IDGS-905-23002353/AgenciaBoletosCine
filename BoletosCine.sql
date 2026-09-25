DROP DATABASE IF EXISTS cine;

CREATE DATABASE IF NOT EXISTS cine;
USE cine;

CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) DEFAULT 'cliente'
);

CREATE TABLE IF NOT EXISTS eventos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    precio FLOAT NOT NULL,
    imagen_base64 LONGTEXT NOT NULL -- Columna para almacenar la imagen en Base64
);

CREATE TABLE IF NOT EXISTS horarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evento_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora VARCHAR(50) NOT NULL,
    sala VARCHAR(50) NOT NULL,
    capacidad_maxima INT NOT NULL DEFAULT 50, -- Capacidad total de la sala
    boletos_vendidos INT NOT NULL DEFAULT 0,  -- Boletos que ya han sido reservados
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
);

-- Boletos apartados temporalmente: mientras expira_en no pase, nadie mas los puede comprar
CREATE TABLE IF NOT EXISTS apartados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    horario_id INT NOT NULL,
    cantidad INT NOT NULL,
    expira_en DATETIME NOT NULL,
    FOREIGN KEY (horario_id) REFERENCES horarios(id) ON DELETE CASCADE
);


INSERT INTO eventos (titulo, descripcion, precio, imagen_base64) VALUES 
('Avatar: El camino del agua', 'Una aventura épica de ciencia ficción en Pandora.', 85.50, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
('Spider-Man: Across the Spider-Verse', 'Un viaje a través del multiverso con Miles Morales.', 75.00, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');

INSERT INTO horarios (evento_id, fecha, hora, sala, capacidad_maxima, boletos_vendidos) VALUES 
(1, '2026-09-25', '16:30 hrs', 'Sala 4 - VIP', 40, 5),
(1, '2026-09-25', '20:00 hrs', 'Sala 2 - MacroXE', 60, 12),
(2, '2026-09-26', '15:00 hrs', 'Sala 1 - Normal', 50, 0),
(2, '2026-09-26', '18:30 hrs', 'Sala 3 - IMAX', 45, 45); 

select * from eventos;


INSERT INTO usuarios (username, password_hash, rol) 
VALUES ('admin', 'scrypt:32768:8:1$gaaMAe6trB7hIN20$1bce34c393f3ab51399ed2bad180f69f7ef98c2048c69f44b9c091cc05275f6355538a0ed4c9c3defbcf7f83d481671506eb07a457217d85fb4e5942ff4bc532', 'admin');